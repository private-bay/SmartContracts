import aztec from 'aztec.js';
import AuthService from '../../helpers/AuthService';
import Web3Service from '../../helpers/Web3Service';
import {
  valueOf,
  restoreFromSharedSecret,
  approveNoteAccess,
} from '../../utils/note';

export default async function withdrawBalance({
  loanAddress,
  amount,
  balanceSharedSecret,
  lender,
}) {
  if (!loanAddress
    || !balanceSharedSecret
    || !amount
  ) {
    return 0;
  }

  const currentAddress = AuthService.address;
  const publicKey = await AuthService.getPublicKey();

  const balanceNote = await restoreFromSharedSecret(balanceSharedSecret);
  balanceNote.owner = loanAddress;
  const balanceValue = valueOf(balanceNote);

  const newBalanceValue = balanceValue - amount;
  if (newBalanceValue < 0) {
    return 0;
  }

  const newBalanceNote = await aztec.note.create(
    publicKey,
    newBalanceValue,
    loanAddress,
  );

  const withdrawNote = await aztec.note.create(publicKey, amount);

  const {
    proofData,
  } = aztec.proof.joinSplit.encodeJoinSplitTransaction({
    inputNotes: [balanceNote],
    outputNotes: [withdrawNote, newBalanceNote],
    inputNoteOwners: [],
    senderAddress: loanAddress,
    publicOwner: currentAddress,
    kPublic: 0,
  });

  await Web3Service.useContract('Loan')
    .at(loanAddress)
    .method('adjustInterestBalance')
    .send(
      proofData,
    );

  await approveNoteAccess({
    note: newBalanceNote,
    shareWith: lender,
  });

  await approveNoteAccess({
    note: withdrawNote,
  });

  return amount;
}
