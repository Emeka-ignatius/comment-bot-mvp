
// Mocking the environment to test the logic used in reExtractChatId
const rumbleAccounts = [
  { id: 1, platform: 'rumble', isActive: 0, cookies: 'expired', accountName: 'Inactive' },
  { id: 2, platform: 'rumble', isActive: 1, cookies: 'valid', accountName: 'Active' }
];

// The logic used in the router:
const rumbleAccount = rumbleAccounts.find(acc => acc.platform === 'rumble' && acc.isActive === 1 && acc.cookies);

console.log('Testing re-extraction account selection logic...');
if (rumbleAccount && rumbleAccount.id === 2) {
  console.log('✅ SUCCESS: Correctly selected the active account with cookies.');
} else {
  console.log('❌ FAILURE: Failed to select the correct account.');
}
