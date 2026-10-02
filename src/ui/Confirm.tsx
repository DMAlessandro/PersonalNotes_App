import { Panel } from './Panel';

type Props = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** In-app confirmation (spec §4.3: never a browser pop-up). */
export function Confirm({ title, body, confirmLabel, onConfirm, onClose }: Props) {
  return (
    <Panel onClose={onClose} label={title}>
      <div className="form">
        <p className="form-title">{title}</p>
        <p className="form-body">{body}</p>
        <div className="actions">
          <span className="spacer" />
          <button className="secondary" onClick={onClose} autoFocus>
            Cancel
          </button>
          <button
            className="primary danger-fill"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Panel>
  );
}
