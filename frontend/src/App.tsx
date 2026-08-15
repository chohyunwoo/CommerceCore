import { Link, Route, Routes } from 'react-router-dom';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderCompletePage } from './pages/OrderCompletePage';
import { OrderLookupPage } from './pages/OrderLookupPage';
import { AdminPage } from './pages/AdminPage';
import './App.css';

function App() {
  return (
    <>
      <header id="site-header">
        <nav className="header-left">
          <Link to="/">Shop</Link>
          <Link to="/orders/lookup">주문조회</Link>
        </nav>
        <Link to="/" className="header-logo">CommerceCore</Link>
        <div className="header-right">
          <Link to="/cart">장바구니</Link>
          <Link to="/admin">관리자</Link>
        </div>
      </header>
      <main id="content">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-complete" element={<OrderCompletePage />} />
          <Route path="/orders/lookup" element={<OrderLookupPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
