/**
 * Mock del módulo de Supabase para pruebas unitarias.
 * Simula las operaciones de la base de datos sin conexión real.
 */

const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdate = jest.fn(() => ({ eq: jest.fn(() => ({ select: mockSelect })) }));
const mockDelete = jest.fn(() => ({ eq: jest.fn() }));
const mockEq = jest.fn(() => ({ single: mockSingle, maybeSingle: mockMaybeSingle, select: mockSelect }));
const mockOrder = jest.fn();

const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      eq: jest.fn(() => ({
        single: mockSingle,
        maybeSingle: mockMaybeSingle,
      })),
    })),
    order: mockOrder,
  })),
}));

const mockGetUser = jest.fn();

const supabase = {
  from: mockFrom,
  auth: {
    getUser: mockGetUser,
  },
};

module.exports = {
  supabase,
  mockFrom,
  mockInsert,
  mockSelect,
  mockSingle,
  mockMaybeSingle,
  mockUpdate,
  mockDelete,
  mockEq,
  mockOrder,
  mockGetUser,
};
