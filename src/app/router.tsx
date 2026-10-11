import { Authenticated, CanAccess } from "@refinedev/core";
import { ErrorComponent, ThemedLayout } from "@refinedev/antd";
import { CatchAllNavigate, NavigateToResource } from "@refinedev/react-router";
import { Outlet, Route, Routes } from "react-router";

import { Login } from "../auth/Login";
import { SyncStatus } from "../components/SyncStatus";
import { CategoryCreate } from "../modules/categories/pages/CategoryCreate";
import { CategoryEdit } from "../modules/categories/pages/CategoryEdit";
import { CategoryList } from "../modules/categories/pages/CategoryList";
import { ProductCreate } from "../modules/products/pages/ProductCreate";
import { ProductEdit } from "../modules/products/pages/ProductEdit";
import { ProductList } from "../modules/products/pages/ProductList";
import { ProductShow } from "../modules/products/pages/ProductShow";
import { UomCreate } from "../modules/uoms/pages/UomCreate";
import { UomEdit } from "../modules/uoms/pages/UomEdit";
import { UomList } from "../modules/uoms/pages/UomList";
import { UserCreate } from "../modules/users/pages/UserCreate";
import { UserEdit } from "../modules/users/pages/UserEdit";
import { UserList } from "../modules/users/pages/UserList";

export function AppRoutes() {
  return (
    <>
      <SyncStatus />
      <Routes>
        <Route
          element={
            <Authenticated
              key="authenticated-inner"
              fallback={<CatchAllNavigate to="/login" />}
            >
              <ThemedLayout>
                <Outlet />
              </ThemedLayout>
            </Authenticated>
          }
        >
          <Route index element={<NavigateToResource resource="products" />} />
          <Route path="/products">
            <Route index element={<ProductList />} />
            <Route
              path="create"
              element={
                <CanAccess
                  resource="products"
                  action="create"
                  fallback={<ErrorComponent />}
                >
                  <ProductCreate />
                </CanAccess>
              }
            />
            <Route
              path="edit/:id"
              element={
                <CanAccess
                  resource="products"
                  action="edit"
                  fallback={<ErrorComponent />}
                >
                  <ProductEdit />
                </CanAccess>
              }
            />
            <Route path="show/:id" element={<ProductShow />} />
          </Route>
          <Route path="/products/categories">
            <Route index element={<CategoryList />} />
            <Route
              path="create"
              element={
                <CanAccess
                  resource="categories"
                  action="create"
                  fallback={<ErrorComponent />}
                >
                  <CategoryCreate />
                </CanAccess>
              }
            />
            <Route
              path="edit/:id"
              element={
                <CanAccess
                  resource="categories"
                  action="edit"
                  fallback={<ErrorComponent />}
                >
                  <CategoryEdit />
                </CanAccess>
              }
            />
          </Route>
          <Route path="/products/uoms">
            <Route index element={<UomList />} />
            <Route
              path="create"
              element={
                <CanAccess
                  resource="uoms"
                  action="create"
                  fallback={<ErrorComponent />}
                >
                  <UomCreate />
                </CanAccess>
              }
            />
            <Route
              path="edit/:id"
              element={
                <CanAccess
                  resource="uoms"
                  action="edit"
                  fallback={<ErrorComponent />}
                >
                  <UomEdit />
                </CanAccess>
              }
            />
          </Route>
          <Route path="/users">
            <Route
              index
              element={
                <CanAccess
                  resource="profiles"
                  action="list"
                  fallback={<ErrorComponent />}
                >
                  <UserList />
                </CanAccess>
              }
            />
            <Route
              path="create"
              element={
                <CanAccess
                  resource="profiles"
                  action="create"
                  fallback={<ErrorComponent />}
                >
                  <UserCreate />
                </CanAccess>
              }
            />
            <Route
              path="edit/:id"
              element={
                <CanAccess
                  resource="profiles"
                  action="edit"
                  fallback={<ErrorComponent />}
                >
                  <UserEdit />
                </CanAccess>
              }
            />
          </Route>
          <Route path="*" element={<ErrorComponent />} />
        </Route>

        <Route
          element={
            <Authenticated key="authenticated-outer" fallback={<Outlet />}>
              <NavigateToResource resource="products" />
            </Authenticated>
          }
        >
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </>
  );
}
