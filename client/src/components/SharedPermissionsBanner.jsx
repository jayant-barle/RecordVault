import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function SharedPermissionsBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="warning-banner">
      <div className="warning-banner-content">
        <AlertTriangle size={16} />
        <span>
          <strong>Shared Permission Model:</strong> All authenticated users possess full record management privileges, including Replace, Edit, and Delete operations. Changes affect the global shared database.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}
        title="Dismiss warning"
      >
        <X size={16} />
      </button>
    </div>
  );
}
