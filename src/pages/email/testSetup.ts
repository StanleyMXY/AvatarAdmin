// The helpers of the page tests of the e-mail templates are those of the SMS pages (the same
// administrators, the same stand-ins for fetch); only the state to put back differs and is already
// reset by `signIn`.

export { emailState } from '../../../mock/_core/emailData';
export {
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  NOW,
  overrideFetch,
  settled,
  signIn,
  writesOf,
} from '../sms/testSetup';
