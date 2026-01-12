import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import '../styles/UserProfile.css';

function UserProfile() {
  const { user } = useAuth0();

  if (!user) return null;

  return (
    <div className="user-profile">
      {user.picture && (
        <img
          src={user.picture}
          alt={user.name}
          className="user-avatar"
        />
      )}
      <span className="user-name">{user.name}</span>
    </div>
  );
}

export default UserProfile;
