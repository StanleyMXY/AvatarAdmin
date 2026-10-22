/**
 * Stand-in for `@ant-design/plots` in component tests: renders the data as text so tests can
 * assert what a chart was given, without a canvas.
 */
type ChartProps = { data?: unknown; [key: string]: unknown };

function ChartStub({ kind, data }: { kind: string; data: unknown }) {
  return <div data-testid={`chart-${kind}`}>{JSON.stringify(data ?? [])}</div>;
}

export const Line = (props: ChartProps) => <ChartStub kind="line" data={props.data} />;
export const Column = (props: ChartProps) => <ChartStub kind="column" data={props.data} />;
export const Bar = (props: ChartProps) => <ChartStub kind="bar" data={props.data} />;
export const Area = (props: ChartProps) => <ChartStub kind="area" data={props.data} />;
export const Pie = (props: ChartProps) => <ChartStub kind="pie" data={props.data} />;
export const Funnel = (props: ChartProps) => <ChartStub kind="funnel" data={props.data} />;
export const Heatmap = (props: ChartProps) => <ChartStub kind="heatmap" data={props.data} />;
export const DualAxes = (props: ChartProps) => <ChartStub kind="dual-axes" data={props.data} />;
