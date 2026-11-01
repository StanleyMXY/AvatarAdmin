import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useUploadSlot } from './useUploadSlot';

type Picture = { uploadId: string; fileName: string };

describe('useUploadSlot', () => {
  it('starts empty and not busy', () => {
    const { result } = renderHook(() => useUploadSlot<Picture>());
    expect(result.current.upload).toBeUndefined();
    expect(result.current.uploadId).toBeUndefined();
    expect(result.current.busy).toBe(false);
    expect(result.current.version).toBe(0);
  });

  it('holds the whole record the server gave and its upload id', () => {
    const { result } = renderHook(() => useUploadSlot<Picture>());
    act(() => result.current.fieldProps.onUploaded({ uploadId: 'u-1', fileName: 'ภาพ.png' }));
    expect(result.current.upload).toEqual({ uploadId: 'u-1', fileName: 'ภาพ.png' });
    expect(result.current.uploadId).toBe('u-1');
  });

  it('holds just an upload id for a form that shows nothing about the file', () => {
    const { result } = renderHook(() => useUploadSlot());
    act(() => result.current.fieldProps.onUploaded({ uploadId: 'u-2' }));
    expect(result.current.uploadId).toBe('u-2');
  });

  it('tells whether an upload is running', () => {
    const { result } = renderHook(() => useUploadSlot());
    act(() => result.current.fieldProps.onBusyChange(true));
    expect(result.current.busy).toBe(true);
    act(() => result.current.fieldProps.onBusyChange(false));
    expect(result.current.busy).toBe(false);
  });

  it('forgets the record when the control is cleared, and keeps the version and the busy flag', () => {
    const { result } = renderHook(() => useUploadSlot());
    act(() => {
      result.current.fieldProps.onUploaded({ uploadId: 'u-3' });
      result.current.fieldProps.onBusyChange(true);
    });
    act(() => result.current.fieldProps.onCleared());
    expect(result.current.uploadId).toBeUndefined();
    expect(result.current.upload).toBeUndefined();
    expect(result.current.busy).toBe(true);
    expect(result.current.version).toBe(0);
  });

  it('on reset forgets the record, is not busy, and changes the version each time', () => {
    const { result } = renderHook(() => useUploadSlot());
    act(() => {
      result.current.fieldProps.onUploaded({ uploadId: 'u-4' });
      result.current.fieldProps.onBusyChange(true);
    });
    act(() => result.current.reset());
    expect(result.current.uploadId).toBeUndefined();
    expect(result.current.busy).toBe(false);
    expect(result.current.version).toBe(1);
    act(() => result.current.reset());
    expect(result.current.version).toBe(2);
  });

  it('gives the same reset function on every render, also after a reset', () => {
    const { result, rerender } = renderHook(() => useUploadSlot());
    const first = result.current.reset;
    rerender();
    expect(result.current.reset).toBe(first);
    act(() => result.current.reset());
    expect(result.current.reset).toBe(first);
  });
});
