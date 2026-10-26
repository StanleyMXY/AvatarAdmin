import { LinkTargetField, type LinkTargetValue } from '../../components/LinkTargetField';

type Props = {
  value?: LinkTargetValue;
  onChange?: (value: LinkTargetValue) => void;
  disabled?: boolean;
};

/** The link control of the shared kit, in a box a test can find (the same one on all three forms). */
export function LinkField(props: Props) {
  return (
    <div data-testid="link-field">
      <LinkTargetField {...props} />
    </div>
  );
}
