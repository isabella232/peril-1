import { getGPGIdentity, clearsign, getRootSHA, createOverride, importPublicKeys, gatherFacts } from './override';
import { config } from '../test/fixtures/testConfig';
import { cloneDeep } from 'lodash';
import path from 'path';

describe('override features', () => {

  const gpgIdRaw = 'uid:u::::14122::41ECEBA211::Some User <some.user@company.com>::::::::::0:';
  const gpgId = 'Some User <some.user@company.com>';

  it('getGPGIdentity parses gpg secret keys list output for identity', async () => {
    const mockRunCmd = jest.fn();
    const id = await getGPGIdentity(mockRunCmd.mockResolvedValueOnce({ stdout: gpgIdRaw }));
    expect(id).toEqual(gpgId);
  });

  it('getGPGIdentity returns empty string when gpg is not available', async () => {
    const konfig = cloneDeep(config);
    konfig.facts.scm.gpgPath = undefined;
    const id = await getGPGIdentity(konfig);
    expect(id).toEqual('');
  });

  it('getGPGIdentity returns empty string when gpg fails to execute properly', async () => {
    const mockRunCmd = jest.fn().mockRejectedValue(new Error('ENOENT'));
    const id = await getGPGIdentity(mockRunCmd);
    expect(id).toEqual('');
  });

  it('getGPGIdentity returns empty string when gpg lists no identifiable keys', async () => {
    const mockRunCmd = jest.fn().mockResolvedValueOnce({ stdout: 'grp:::::::::9323654C065DA99813D377011A1:' });
    const id = await getGPGIdentity(mockRunCmd);
    expect(id).toEqual('');
  });

  it('clearsign signs stringified object with GPG', async () => {
    const signedOutput = `
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA256

{ "test": "data" }
-----BEGIN PGP SIGNATURE-----

eQIcBAEBCAAdFiEEYorQz7eDsQ/hmM9h5zhp4CrmDB4FAmBEFHAACgkQ5zhp4Crm
dpVD0hfMB1rG4n8HtvVOyoju0S62eRShON5u1bDyJsuIoB34fOGTyb7hVEEsjHZq
nVfN9h4UoywyzONofymnOKdgxxVjbhuttkBztAujaolkeR8Uhp0XsNuBj3ARqKMM
gopUr20+jOVMJiFRKq+AnHZ2rZ78BCPCcFv4xqImai0gAz/1K+nv4yPP80Al6KO+
/11FVdBN381FaEGG5xeBgKThFyGBriSDbmP4EHpYersNa40/2wo=
-----END PGP SIGNATURE-----`;
    const mockRunCmd = jest.fn().mockResolvedValueOnce({ stdout: signedOutput, failed: false });
    const sig = await clearsign({test: 'data'}, mockRunCmd);
    expect(sig).toEqual(signedOutput);
  });

  it('clearsign returns empty string when gpg fails to execute properly', async () => {
    const mockRunCmd = jest.fn().mockRejectedValue(new Error('ENOENT'));
    const id = await clearsign('test data', mockRunCmd);
    expect(id).toEqual('');
  });

  const rootSHA = 'a1b2c3d4e5f60718293a';

  it('getRootSHA returns the SHA of the initial commit for local repo', async () => {
    const mockRunCmd = jest.fn().mockResolvedValueOnce({ stdout: rootSHA });
    const sha = await getRootSHA(mockRunCmd);
    expect(sha).toEqual(rootSHA);
  });

  it('createOverride returns signable object', async () => {
    const justification = 'test override';
    const expiry = Date.now();
    const mockRunCmd = jest.fn()
      .mockResolvedValueOnce({ stdout: gpgIdRaw })
      .mockResolvedValueOnce({ stdout: rootSHA });
    const override = await createOverride(-10, expiry, justification, mockRunCmd);
    expect(override.credit).toBe(-10);
    expect(override.exp).toBe(expiry);
    expect(override.justification).toBe(justification);
    expect(override.rootSHA).toBe(rootSHA);
    expect(override.signedBy).toBe(gpgId);
  });

  it('importPublicKeys imports all keys found in trusted keyDir', async () => {
    const mockRunCmd = jest.fn()
      .mockResolvedValue({stdout: `
gpg: keybox './somekeyring.gpg' created
gpg: key C348A9E00AE60B1C: public key "Trusted User <trusted.user@corp.com>" imported
gpg: Total number processed: 1
gpg:               imported: 1
`});
    const keysDir = path.join(__dirname, '../test/fixtures/gpgKeys');
    await importPublicKeys(keysDir, mockRunCmd);
    expect(mockRunCmd).toHaveBeenCalledTimes(2);
  });

  it('gatherFacts gathers basic Risk Override facts', async () => {
    const konfig = cloneDeep(config);
    konfig.flags.pubkeyDir = path.join(__dirname, '../test/fixtures/gpgKeys');
    konfig.flags.dir = path.join(__dirname, '../test/fixtures');
    const facts = await gatherFacts(konfig);
    expect(facts.override.trustedPubKeysDir).toEqual(konfig.flags.pubkeyDir);
    expect(facts.override.trustedPubKeys.length).toEqual(2);
    expect(facts.override.repoOverrides.length).toEqual(1);
  });

});

