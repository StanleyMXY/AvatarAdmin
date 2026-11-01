import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusTag } from './StatusTag';

const options = {
  ACTIVE: { label: 'Active', color: 'green' },
  BANNED: { label: 'Banned', color: 'red' },
};

describe('StatusTag', () => {
  it('shows the text of a known status with its colour', () => {
    render(<StatusTag status="ACTIVE" options={options} />);
    expect(screen.getByText('Active').className).toContain('ant-tag-green');
  });

  it('shows an unknown status as it is', () => {
    render(<StatusTag status="NEW_STATE" options={options} />);
    expect(screen.getByText('NEW_STATE')).toBeInTheDocument();
  });

  it('does not take inherited object keys for statuses', () => {
    render(<StatusTag status="toString" options={options} />);
    expect(screen.getByText('toString')).toBeInTheDocument();
    render(<StatusTag status="constructor" options={options} />);
    expect(screen.getByText('constructor')).toBeInTheDocument();
  });

  it('does not take a label or a colour from the prototype of the options (a polluted Object.prototype)', () => {
    const proto = Object.prototype as unknown as Record<string, unknown>;
    proto.RISKY = { label: 'FROM PROTOTYPE', color: 'red' };
    try {
      render(<StatusTag status="RISKY" options={options} />);
      expect(screen.getByText('RISKY')).toBeInTheDocument();
      expect(screen.queryByText('FROM PROTOTYPE')).toBeNull();
      expect(screen.getByText('RISKY').className).not.toContain('ant-tag-red');
    } finally {
      delete proto.RISKY;
    }
  });

  it('shows a dash for no status', () => {
    render(<StatusTag status={null} options={options} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('works with texts in other scripts', () => {
    render(
      <StatusTag status="ACTIVE" options={{ ACTIVE: { label: 'ใช้งานอยู่ · نشط · Hoạt động' } }} />,
    );
    expect(screen.getByText('ใช้งานอยู่ · نشط · Hoạt động')).toBeInTheDocument();
  });
});
