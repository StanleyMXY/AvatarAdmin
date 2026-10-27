/**
 * Stand-in for `@ant-design/plots` in component tests: renders the data as text so tests can
 * assert what a chart was given, without a canvas.
 */
type ChartProps = { data?: unknown; [key: string]: unknown };

function ChartStub({ kind, data, config }: { kind: string; data: unknown; config: unknown }) {
  return (
    <div data-testid={`chart-${kind}`} data-config={JSON.stringify(config)}>
      {JSON.stringify(data ?? [])}
    </div>
  );
}

/** Everything a chart was given except its data, so tests can assert theme and axes. */
const configOf = (props: ChartProps) => {
  const { data: _data, ...rest } = props;
  return rest;
};

export const Line = (props: ChartProps) => (
  <ChartStub kind="line" data={props.data} config={configOf(props)} />
);
export const Column = (props: ChartProps) => (
  <ChartStub kind="column" data={props.data} config={configOf(props)} />
);
export const Bar = (props: ChartProps) => (
  <ChartStub kind="bar" data={props.data} config={configOf(props)} />
);
export const Area = (props: ChartProps) => (
  <ChartStub kind="area" data={props.data} config={configOf(props)} />
);
export const Pie = (props: ChartProps) => (
  <ChartStub kind="pie" data={props.data} config={configOf(props)} />
);
export const Funnel = (props: ChartProps) => (
  <ChartStub kind="funnel" data={props.data} config={configOf(props)} />
);
export const Heatmap = (props: ChartProps) => (
  <ChartStub kind="heatmap" data={props.data} config={configOf(props)} />
);
export const DualAxes = (props: ChartProps) => (
  <ChartStub kind="dual-axes" data={props.data} config={configOf(props)} />
);
