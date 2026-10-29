import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const client = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Testing cross-type UoM functionality...");

  // 1. Fetch UoMs
  const { data: uoms, error: uomErr } = await client
    .from("uoms")
    .select("id, symbol, uom_type");
  if (uomErr) throw uomErr;

  const kg = uoms?.find((u) => u.symbol?.toLowerCase() === "kg");
  const pcs = uoms?.find((u) => u.symbol?.toLowerCase() === "pcs");

  if (!kg || !pcs) {
    throw new Error("Missing required seed UoMs (kg or pcs)");
  }

  console.log(`Found kg (${kg.id}, ${kg.uom_type}) and pcs (${pcs.id}, ${pcs.uom_type})`);

  // 2. Create a test product with base UoM = kg
  const testSku = `TEST-EGG-${Date.now()}`;
  const { data: product, error: prodErr } = await client
    .from("products")
    .insert({
      user_id: "00000000-0000-0000-0000-0000000000a1",
      sku: testSku,
      name: "Test Fresh Farm Eggs",
      base_uom_id: kg.id,
      price: 28000,
    })
    .select()
    .single();

  if (prodErr) throw prodErr;
  console.log(`Created product: ${product.id} (Base: kg)`);

  try {
    // Check base product_uom created
    const { data: baseUomRow } = await client
      .from("product_uoms")
      .select("*")
      .eq("product_id", product.id)
      .eq("uom_id", kg.id)
      .single();

    if (!baseUomRow) throw new Error("Base product_uom was not auto-created");
    console.log(`Base product_uom row confirmed: ${baseUomRow.id}`);

    // 3. Test: Attempting global cross-type conversion MUST fail
    console.log("Testing that global conversion across families fails...");
    const { error: globalCrossErr } = await client
      .from("product_uoms")
      .insert({
        product_id: product.id,
        uom_id: pcs.id,
        parent_product_uom_id: baseUomRow.id,
        quantity_in_parent: 0.0625,
        conversion_mode: "global",
      });

    if (!globalCrossErr) {
      throw new Error("Expected global cross-type conversion to fail, but it succeeded!");
    }
    console.log(`Global cross-type correctly rejected: ${globalCrossErr.message}`);

    // 4. Test: Local cross-type conversion MUST succeed
    console.log("Testing that local cross-type conversion succeeds...");
    const { data: pcRow, error: localCrossErr } = await client
      .from("product_uoms")
      .insert({
        product_id: product.id,
        uom_id: pcs.id,
        parent_product_uom_id: baseUomRow.id,
        quantity_in_parent: 0.0625,
        conversion_mode: "local",
      })
      .select()
      .single();

    if (localCrossErr) throw localCrossErr;
    console.log(`Local cross-type succeeded: 1 pc = ${pcRow.quantity_in_parent} kg`);

    // 5. Test: Cycle detection is maintained
    console.log("Testing cycle detection...");
    const { error: cycleErr } = await client
      .from("product_uoms")
      .update({ parent_product_uom_id: pcRow.id })
      .eq("id", baseUomRow.id);

    // Either deferred trigger or row trigger will block cycles or multiple roots
    if (!cycleErr) {
      throw new Error("Expected cycle to be rejected!");
    }
    console.log(`Cycle / root violation correctly rejected: ${cycleErr.message}`);

    // 6. Test: Promote pcs to base (re-rooting)
    console.log("Testing base UoM re-rooting to cross-type unit (pcs)...");
    const { error: reRootErr } = await client
      .from("products")
      .update({ base_uom_id: pcs.id })
      .eq("id", product.id);

    if (reRootErr) throw reRootErr;

    // Check re-rooted rows
    const { data: updatedRows } = await client
      .from("product_uoms")
      .select("*")
      .eq("product_id", product.id);

    const newRoot = updatedRows?.find((r) => r.parent_product_uom_id === null);
    const newKgChild = updatedRows?.find((r) => r.uom_id === kg.id);

    if (newRoot?.uom_id !== pcs.id) {
      throw new Error(`Expected pcs to be new root, found: ${newRoot?.uom_id}`);
    }
    if (newKgChild?.parent_product_uom_id !== newRoot.id) {
      throw new Error("Expected kg to be child of pcs after re-rooting");
    }
    console.log(
      `Re-rooting succeeded! New root: pcs, child: kg with inverted factor: ${newKgChild.quantity_in_parent} pcs/kg`,
    );

    console.log("All database tests passed successfully! 🎉");
  } finally {
    // Cleanup
    await client.from("products").delete().eq("id", product.id);
    console.log("Cleaned up test product.");
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
