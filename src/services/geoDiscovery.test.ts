import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geoDiscovery } from './geoDiscoveryService';
import { geoDb } from './geographicDbService';
import { batchMouzasForQueue } from './queueEngine';
import { MouzaNode } from '../types/land';

// Mock the global fetch
global.fetch = vi.fn();

// Mock geographicDbService
vi.mock('./geographicDbService', () => ({
  geoDb: {
    saveDistrict: vi.fn(),
    saveUpazila: vi.fn(),
    saveMouzas: vi.fn(),
    getDistricts: vi.fn().mockResolvedValue([]),
    getUpazilas: vi.fn().mockResolvedValue([]),
    getMouzas: vi.fn().mockResolvedValue([]),
    logRejection: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('Phase 4-7: Nationwide Geographic Discovery & Batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Scenario 1: Should discover districts from eporcha.tech and persist to Firestore', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: '1', name_en: 'Dhaka', name_bn: 'ঢাকা' },
        { id: '2', name_en: 'Gazipur', name_bn: 'গাজীপুর' }
      ])
    });

    const districts = await geoDiscovery.discoverDistricts('div-dhaka');
    
    expect(districts).toHaveLength(2);
    expect(districts[0].nameEn).toBe('Dhaka');
    expect(geoDb.saveDistrict).toHaveBeenCalledTimes(2);
  });

  it('Scenario 4: Should discover ALL Mouzas for Nabinagar (176 expected) without truncation', async () => {
    // Simulate a large response for Nabinagar
    const mockMouzas = Array.from({ length: 176 }, (_, i) => ({
      jl_no: String(i + 1),
      name_en: `Mouza ${i + 1}`,
      name_bn: `মৌজা ${i + 1}`,
      union_en: 'Union A',
      union_bn: 'ইউনিয়ন এ'
    }));

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMouzas)
    });

    const mouzas = await geoDiscovery.discoverMouzas('upz-nabinagar');
    
    expect(mouzas).toHaveLength(176);
    expect(mouzas[175].jlNo).toBe('176');
    expect(geoDb.saveMouzas).toHaveBeenCalledWith(expect.arrayContaining([expect.anything()]), 'upz-nabinagar');
  });

  it('Scenario 6: Should implement exactly seven-mouza batching for the download queue', () => {
    const mockMouzas: MouzaNode[] = Array.from({ length: 15 }, (_, i) => ({
      id: `mz-${i}`,
      jlNo: String(i + 1),
      nameEn: `Mouza ${i}`,
      nameBn: `মৌজা ${i}`,
      unionNameEn: 'Union',
      unionNameBn: 'ইউনিয়ন',
      availableSurveys: ['RS'],
      estimatedKhatians: 100,
      estimatedDags: 200,
      mapSheets: [1]
    }));

    const batches = batchMouzasForQueue(mockMouzas, 7);
    
    expect(batches).toHaveLength(3); // 7 + 7 + 1
    expect(batches[0]).toHaveLength(7);
    expect(batches[1]).toHaveLength(7);
    expect(batches[2]).toHaveLength(1);
    expect(batches[0][0].id).toBe('mz-0');
    expect(batches[1][0].id).toBe('mz-7');
  });

  it('Scenario 7: Should handle duplicate Mouza records gracefully during discovery', async () => {
    const duplicateData = [
      { jl_no: '10', name_en: 'Duplicate', name_bn: 'ডুপ্লিকেট' },
      { jl_no: '10', name_en: 'Duplicate', name_bn: 'ডুপ্লিকেট' }
    ];

    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(duplicateData)
    });

    const mouzas = await geoDiscovery.discoverMouzas('upz-test');
    
    expect(mouzas).toHaveLength(1);
  });
});
