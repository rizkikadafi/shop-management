import "@ant-design/v5-patch-for-react-19";
import { BrowserRouter } from "react-router";

import { AppProviders } from "./providers";
import { AppRoutes } from "./router";

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
