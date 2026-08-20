import { useEffect } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderLookupPage } from './pages/OrderLookupPage';
import { AdminPage } from './pages/AdminPage';
import { ImageSearchPage } from './pages/ImageSearchPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { PaymentFailPage } from './pages/PaymentFailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MyPage } from './pages/MyPage';
import { MyOrderDetailPage } from './pages/MyOrderDetailPage';
import { prefetchImageEmbeddingModel } from './lib/imageEmbedding';
import { useAuth } from './context/AuthContext';
import './App.css';

function AuthHeaderLinks() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Link to="/login">로그인</Link>;
  }

  return (
    <>
      <Link to="/my">마이페이지</Link>
      {user.role === 'admin' && <Link to="/admin">관리자</Link>}
      <span className="header-username">{user.name}님</span>
      <button type="button" className="header-logout-btn" onClick={() => void logout()}>
        로그아웃
      </button>
    </>
  );
}

function App() {
  useEffect(() => {
    prefetchImageEmbeddingModel();
  }, []);

  return (
    <>
      <header id="site-header">
        <nav className="header-left">
          <Link to="/">Shop</Link>
          <Link to="/orders/lookup">주문조회</Link>
          <Link to="/image-search">이미지 검색</Link>
        </nav>
        <Link to="/" className="header-logo">CommerceCore</Link>
        <div className="header-right">
          <Link to="/cart">장바구니</Link>
          <AuthHeaderLinks />
        </div>
      </header>
      <main id="content">
        <Routes>
          <Route path="/" element={<ProductListPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders/lookup" element={<OrderLookupPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/image-search" element={<ImageSearchPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/fail" element={<PaymentFailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/my/orders/:orderNumber" element={<MyOrderDetailPage />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
