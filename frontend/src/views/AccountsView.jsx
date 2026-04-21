import { useEffect, useMemo, useState } from "react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "cashier", label: "Cashier" },
  { value: "guest", label: "Guest" },
];

export default function AccountsView({ accounts, currentUserId, onChangeRole, onDeleteAccount, busy }) {
  const [draftRoles, setDraftRoles] = useState({});

  useEffect(() => {
    setDraftRoles((current) => {
      const next = {};
      for (const account of accounts) {
        const draft = current[account.id];
        if (draft && draft !== account.role) {
          next[account.id] = draft;
        }
      }
      return next;
    });
  }, [accounts]);

  const rows = useMemo(
    () =>
      accounts.map((account) => ({
        ...account,
        draftRole: draftRoles[account.id] || account.role,
      })),
    [accounts, draftRoles]
  );

  return (
    <section className="view">
      <header className="view-header">
        <h2>Accounts</h2>
        <p className="muted">Manage account privileges for Admin, Cashier, and Guest roles.</p>
      </header>

      <article className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty">
                    No accounts found.
                  </td>
                </tr>
              ) : (
                rows.map((account) => {
                  const unchanged = account.draftRole === account.role;
                  const isSelf = currentUserId === account.id;
                  return (
                    <tr key={account.id}>
                      <td>
                        {account.full_name}
                        {isSelf ? <span className="badge">You</span> : null}
                      </td>
                      <td>{account.username}</td>
                      <td>
                        <select
                          value={account.draftRole}
                          onChange={(event) =>
                            setDraftRoles((current) => ({ ...current, [account.id]: event.target.value }))
                          }
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button
                            className="btn-primary"
                            disabled={busy || unchanged}
                            onClick={() => onChangeRole(account.id, account.draftRole)}
                          >
                            Update role
                          </button>
                          <button
                            className="btn-danger"
                            disabled={busy || isSelf}
                            onClick={() => onDeleteAccount(account.id, account.full_name)}
                            title={isSelf ? "You cannot delete your own account." : "Delete account"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
