import { UnlockRefusal, type UnlockRefused } from "@domicile-desktop/sdk/system";

/**
 * What the lock screen says about a refused passphrase, `seconds` after the
 * refusal arrived. An unverifiable one is not called wrong: PAM could not
 * check it, as when /etc/pam.d/domicile went missing.
 */
export const refusalText = (refused: UnlockRefused, seconds: number): string => {
  const wait = Math.ceil(refused.retryInMs / 1000 - seconds);
  const waiting = wait > 0 ? ` Try again in ${wait} s.` : "";
  switch (refused.refusal) {
    case UnlockRefusal.WrongPassphrase:
      return `Wrong passphrase.${waiting}`;
    case UnlockRefusal.Unverifiable:
      return `The passphrase could not be checked (is /etc/pam.d/domicile there?).${waiting}`;
    case UnlockRefusal.TooSoon:
      return `Too many tries.${waiting || " Try again."}`;
  }
};
