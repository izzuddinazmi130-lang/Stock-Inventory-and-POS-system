import React from 'react';
import Button from './Button';

// Older import path for the form kit. Everything now lives in the UI primitives; these re-exports keep
// `import { Modal, Field, … } from '../../components/ui/Form'` working.
export { Modal } from './Modal';
export {
  Field, Input, PasswordInput, Select, Textarea, MoneyInput, SearchInput, Checkbox, QuantityStepper, FormSection, ChoiceCards,
  Alert, FormAlert, inputClass, toDateInput,
} from './controls';

/** Submit button (type="submit" by default). Prefer <Button type="submit">. */
export function PrimaryButton({ type = 'submit', ...props }) {
  return <Button type={type} variant="primary" {...props} />;
}

/** Secondary/cancel button. Prefer <Button variant="secondary">. */
export function SecondaryButton(props) {
  return <Button variant="secondary" {...props} />;
}
