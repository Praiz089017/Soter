'use strict';

const { parseArgs } = require('../run-e2e');

describe('run-e2e parseArgs', () => {
  it('applies the documented defaults', () => {
    const args = parseArgs([]);
    expect(args.apiPort).toBe(8099);
    expect(args.maestro).toBe('maestro');
    expect(args.reconnectDelayMs).toBe(40000);
    expect(args.only).toEqual([]);
    expect(args.noInstall).toBeUndefined();
    expect(args.skipNetwork).toBeUndefined();
  });

  it('parses flow selection, device and boolean flags', () => {
    const args = parseArgs([
      '--flow',
      'scan-valid-qr',
      '--flow',
      'offline-queue',
      '--device',
      'emulator-5554',
      '--no-install',
      '--skip-network',
      '--reconnect-delay-ms',
      '15000',
    ]);

    expect(args.only).toEqual(['scan-valid-qr', 'offline-queue']);
    expect(args.device).toBe('emulator-5554');
    expect(args.noInstall).toBe(true);
    expect(args.skipNetwork).toBe(true);
    expect(args.reconnectDelayMs).toBe(15000);
  });

  it('rejects unknown arguments instead of silently ignoring them', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument/);
  });
});
