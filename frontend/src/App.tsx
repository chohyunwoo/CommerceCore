import { Route, Routes } from 'react-router-dom';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import './App.css';

function App() {
  return (
    <main id="content">
      <Routes>
        <Route path="/" element={<ProductListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
      </Routes>
    </main>
  );
}

export default App;
