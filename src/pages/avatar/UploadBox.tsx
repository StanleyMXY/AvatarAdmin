import type { ReactNode } from 'react';

// Inside an Ant Design form, the form's own style shows a file input again although the upload
// control hides it (`hidden`), so a second, native "choose file" box appears beside the button.
// The shared control is not edited from this module (see the report); the box hides it here.
const HIDE_NATIVE_INPUT = '.avatar-upload-box input[type="file"] { display: none !important; }';

/** Wraps an `UploadField` that sits in a form, so that only its own button shows. */
export function UploadBox({ children }: { children: ReactNode }) {
  return (
    <div className="avatar-upload-box">
      <style>{HIDE_NATIVE_INPUT}</style>
      {children}
    </div>
  );
}
