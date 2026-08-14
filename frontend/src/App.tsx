import { Link, Route, Routes } from 'react-router-dom';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderCompletePage } from './pages/OrderCompletePage';
import { OrderLookupPage } from './pages/OrderLookupPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import './App.css';

function App() {
  return (
    <>
      <header id="site-header">
        <Link to="/">CommerceCore</Link>
        <Link to="/cart">장바구니</Link>
        <Link to="/orders/lookup">주문조회</Link>
        <Link to="/admin">관리자</Link>
      </header>
      <main id="content">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-complete" element={<OrderCompletePage />} />
          <Route path="/orders/lookup" element={<OrderLookupPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
