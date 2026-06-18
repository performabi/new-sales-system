// src/pages/Users.tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import DataTable from '../components/UI/DataTable';
import Modal from '../components/UI/Modal';

import { useAuthStore } from '../store/authStore';

export default function Users() {
  const profile = useAuthStore((s) => s.profile);
  const { users, usersLoading, stores, fetchUsers, fetchStores, addUser, updateUser, deleteUser } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [pin, setPin] = useState('');
  const [assignedStoreId, setAssignedStoreId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchStores(); // Need stores for the dropdown
  }, [fetchUsers, fetchStores]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    let submitError = null;

    if (isEditMode && editingUserId) {
      const res = await updateUser(editingUserId, {
        email, // Send email to update auth.users and users table
        username,
        full_name: fullName,
        role,
        is_active: isActive,
        assigned_store_id: role === 'admin' ? null : (assignedStoreId || null),
      });
      submitError = res.error;
    } else {
      const res = await addUser({
        email,
        password,
        username,
        full_name: fullName,
        role,
        pin,
        assigned_store_id: role === 'admin' ? null : (assignedStoreId || null),
      });
      submitError = res.error;
    }

    setIsSubmitting(false);

    if (submitError) {
      setError(submitError);
    } else {
      closeModal();
    }
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setEmail('');
    setPassword('');
    setUsername('');
    setFullName('');
    setRole('user');
    setPin('');
    setAssignedStoreId('');
    setIsActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setIsEditMode(true);
    setEditingUserId(user.user_id);
    setEmail(user.email || ''); // email might not be in profile
    setPassword('');
    setUsername(user.username);
    setFullName(user.full_name);
    setRole(user.role as 'admin' | 'user');
    setPin('');
    setAssignedStoreId(user.assigned_store_id || '');
    setIsActive(user.is_active ?? true);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
  };

  const columns = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'username', label: 'Username' },
    { key: 'email', label: 'Email' },
    { key: 'role_badge', label: 'Role' },
    { key: 'assigned_store_name', label: 'Assigned Store' },
    { key: 'status_badge', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  const tableData = users.map((u) => ({
    ...u,
    role_badge: (
      <span className={`badge ${u.role === 'super_user' ? 'badge-error' : u.role === 'admin' ? 'badge-secondary' : 'badge-primary'}`}>
        {u.role.replace('_', ' ')}
      </span>
    ),
    status_badge: (
      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-error'}`}>
        {u.is_active ? 'Active' : 'Inactive'}
      </span>
    ),
    actions: (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-sm btn-ghost"
          title="Edit User"
          onClick={(e) => {
            e.stopPropagation();
            openEditModal(u);
          }}
          disabled={u.role === 'super_user' && profile?.role !== 'super_user'}
        >
          ✏️
        </button>
        <button
          className="btn btn-sm btn-ghost"
          title="Reset Password (to Sales12345)"
          onClick={async (e) => {
            e.stopPropagation();
            if (confirm(`Reset password for "${u.username}"?`)) {
              await useAppStore.getState().resetUserPassword(u.user_id);
            }
          }}
          disabled={u.role === 'super_user'}
        >
          🔑
        </button>
        {profile?.role === 'super_user' && u.role !== 'super_user' && (
          <button
            className="btn btn-sm btn-ghost"
            title="Delete User"
            style={{ color: 'red' }}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete user "${u.username}"?`)) {
                deleteUser(u.user_id);
              }
            }}
          >
            🗑️
          </button>
        )}
      </div>
    ),
  }));

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>User Directory</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add User
        </button>
      </div>

      {usersLoading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : (
        <DataTable columns={columns} data={tableData} emptyMessage="No users found." />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditMode ? "Edit User" : "Create New User"}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={profile?.role !== 'super_user' && isEditMode}
            />
          </div>

          {!isEditMode && (
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pin">4-Digit PIN</label>
              <input
                id="pin"
                type="text"
                pattern="[0-9]{4}"
                maxLength={4}
                className="form-input"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                required={!isEditMode}
                placeholder={isEditMode ? "(Unchanged)" : "e.g. 1234"}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="role">Role</label>
            <select
              id="role"
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">Standard User</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {role === 'user' && (
            <div className="form-group">
              <label className="form-label" htmlFor="assignedStoreId">Assigned Store</label>
              <select
                id="assignedStoreId"
                className="form-select"
                value={assignedStoreId}
                onChange={(e) => setAssignedStoreId(e.target.value)}
                required={role === 'user'}
              >
                <option value="">-- Select a Store --</option>
                {stores.map((s) => (
                  <option key={s.store_id} value={s.store_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isEditMode && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                User is Active
              </label>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeModal}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (isEditMode ? 'Update User' : 'Create User')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
