import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

function LoginButton({ className }) {
  const { loginWithRedirect } = useAuth0();

  return (
    <button
      onClick={() => loginWithRedirect()}
      className={`login-button ${className || ''}`}
    >
      Log ind
    </button>
  );
}

export default LoginButton;
