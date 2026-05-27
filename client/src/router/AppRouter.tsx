import { Routes, Route } from "react-router-dom";
import { DocumentEntryPage } from "../pages/DocumentEntryPage";
import { HomePage } from "../pages/HomePage";
import { DocumentListPage } from "../pages/DocumentListPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/documents" element={<DocumentListPage />} />
      <Route path="/doc/:docId" element={<DocumentEntryPage />} />
    </Routes>
  );
}
