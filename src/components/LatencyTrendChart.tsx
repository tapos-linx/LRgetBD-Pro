import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Activity, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { ConcurrencyTunerTelemetry, QueueTask } from '../types/land';
import {
  computeLatencyTrendWindow,
  LatencyTrendPoint,
} from '../services/queueEngine';

interface LatencyTrendChartProps {
  tasks: QueueTask[];
  concurrencyTelemetry?: ConcurrencyTunerTelemetry;
  maxTasks?: number;
}

export const LatencyTrendChart: React.FC<LatencyTrendChartProps> = ({
  tasks,
  concurrencyTelemetry,
  maxTasks = 50,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(780);
  const [hoveredPoint, setHoveredPoint] = useState<LatencyTrendPoint | null>(
    null
  );

  const trendWindow = useMemo(
    () => computeLatencyTrendWindow(tasks, maxTasks),
    [tasks, maxTasks]
  );

  const {
    points,
    overallAverageMs,
    minLatencyMs,
    maxLatencyMs,
    fastCount,
    slowOrTimeoutCount,
    trendDirection,
  } = trendWindow;

  // Observe container resize for responsive D3 rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 240) {
        setContainerWidth(Math.floor(w));
      }
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  // Render D3.js SVG Line & Area Chart
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const width = Math.max(320, containerWidth);
    const height = 230;
    const margin = { top: 20, right: 24, bottom: 34, left: 54 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(80, height - margin.top - margin.bottom);

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Definitions for area gradient
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'd3-avg-latency-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.32);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.02);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: 1 to maxTasks (default 50)
    const xMaxDomain = Math.max(10, points.length > 0 ? Math.max(points.length, 10) : maxTasks);
    const xScale = d3
      .scaleLinear()
      .domain([1, xMaxDomain])
      .range([0, innerWidth]);

    // Y Scale: 0 to dynamic ceiling (minimum 3,200ms to show AIMD thresholds)
    const maxDataY =
      points.length > 0
        ? d3.max(points, (d) => Math.max(d.latencyMs, d.averageLatencyMs)) || 1500
        : 3200;
    const yMaxDomain = Math.max(3200, Math.ceil((maxDataY * 1.15) / 200) * 200);

    const yScale = d3
      .scaleLinear()
      .domain([0, yMaxDomain])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal Y grid lines
    const yTicks = yScale.ticks(5);
    g.append('g')
      .attr('class', 'y-grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-width', 1);

    // Threshold Band 1: Fast Portal Ceiling (1,000 ms)
    if (yMaxDomain >= 1000) {
      const fastY = yScale(1000);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', fastY)
        .attr('y2', fastY)
        .attr('stroke', '#10b981')
        .attr('stroke-opacity', 0.45)
        .attr('stroke-dasharray', '5,4')
        .attr('stroke-width', 1.2);

      g.append('text')
        .attr('x', innerWidth - 4)
        .attr('y', Math.max(10, fastY - 5))
        .attr('text-anchor', 'end')
        .attr('fill', '#34d399')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text('1,000ms Fast Scale-Up Threshold (7x Turbo)');
    }

    // Threshold Band 2: High Latency / Backoff Trigger (2,800 ms)
    if (yMaxDomain >= 2800) {
      const slowY = yScale(2800);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', slowY)
        .attr('y2', slowY)
        .attr('stroke', '#f43f5e')
        .attr('stroke-opacity', 0.5)
        .attr('stroke-dasharray', '5,4')
        .attr('stroke-width', 1.2);

      g.append('text')
        .attr('x', innerWidth - 4)
        .attr('y', Math.max(10, slowY - 5))
        .attr('text-anchor', 'end')
        .attr('fill', '#fb7185')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text('2,800ms Backoff Ceiling (AIMD Step-Down)');
    }

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(10, xMaxDomain))
      .tickFormat((d) => `#${d}`);

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.selectAll('path, line').attr('stroke', '#334155');
    xAxisGroup
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${d}ms`);

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.selectAll('path, line').attr('stroke', '#334155');
    yAxisGroup
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    if (points.length > 0) {
      // 1. Area under the Rolling Average Fetch Latency curve
      const avgAreaGenerator = d3
        .area<LatencyTrendPoint>()
        .x((d) => xScale(d.sequenceIndex))
        .y0(innerHeight)
        .y1((d) => yScale(d.averageLatencyMs))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('fill', 'url(#d3-avg-latency-gradient)')
        .attr('d', avgAreaGenerator);

      // 2. Raw Per-Task Fetch Latency dashed line
      const rawLineGenerator = d3
        .line<LatencyTrendPoint>()
        .x((d) => xScale(d.sequenceIndex))
        .y((d) => yScale(d.latencyMs))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 1.25)
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-opacity', 0.65)
        .attr('d', rawLineGenerator);

      // 3. Primary Average Fetch Latency (ms) smooth line
      const avgLineGenerator = d3
        .line<LatencyTrendPoint>()
        .x((d) => xScale(d.sequenceIndex))
        .y((d) => yScale(d.averageLatencyMs))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('class', 'd3-avg-latency-line')
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2.5)
        .attr('d', avgLineGenerator);

      // 4. Interactive Data Points
      g.selectAll('.d3-latency-point')
        .data(points)
        .join('circle')
        .attr('class', 'd3-latency-point')
        .attr('cx', (d) => xScale(d.sequenceIndex))
        .attr('cy', (d) => yScale(d.averageLatencyMs))
        .attr('r', 4)
        .attr('fill', (d) =>
          d.averageLatencyMs <= 1000
            ? '#10b981'
            : d.averageLatencyMs >= 2800
            ? '#f43f5e'
            : '#f59e0b'
        )
        .attr('stroke', '#020617')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (_event, d) => {
          setHoveredPoint(d);
        })
        .on('mouseleave', () => {
          setHoveredPoint(null);
        });
    } else {
      // Empty-state label inside D3 SVG canvas when awaiting task executions
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '11px')
        .attr('font-family', 'monospace')
        .text(
          'Awaiting task execution — Average Fetch Latency (ms) over last 50 tasks will plot live here'
        );
    }
  }, [points, containerWidth, maxTasks]);

  const effectiveAvgLatency =
    overallAverageMs > 0
      ? overallAverageMs
      : concurrencyTelemetry?.rollingLatencyMs || 0;

  return (
    <div
      ref={containerRef}
      data-testid="d3-latency-trend-panel"
      className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-3"
    >
      {/* Top Header & KPI Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Average Fetch Latency (ms) — Last {maxTasks} Tasks
              </h3>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono-tabular text-slate-300">
                D3.js Live Telemetry
              </span>
              {trendDirection === 'IMPROVING' && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Portal Speed Improving
                </span>
              )}
              {trendDirection === 'DEGRADING' && (
                <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-[10px] font-bold text-rose-300 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Latency Rising (Backoff Risk)
                </span>
              )}
              {trendDirection === 'STABLE' && points.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-bold text-sky-300 flex items-center gap-1">
                  <Minus className="w-3 h-3" />
                  Stable Portal Response
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-bn mt-0.5">
              সর্বশেষ ৫০টি টাস্কের গড় ফেচ ল্যাটেন্সি (ms) ট্রেন্ড · Solid line: Rolling Average Fetch Latency · Dashed line: Per-Task Roundtrip
            </p>
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400">Avg Latency ({points.length}/{maxTasks}): </span>
            <span
              data-testid="d3-avg-latency-value"
              className={`font-bold ${
                effectiveAvgLatency === 0
                  ? 'text-slate-300'
                  : effectiveAvgLatency <= 1000
                  ? 'text-emerald-400'
                  : effectiveAvgLatency >= 2800
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }`}
            >
              {effectiveAvgLatency > 0 ? `${effectiveAvgLatency}ms` : '—'}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-slate-400">Min / Max: </span>
            <span className="text-slate-200 font-semibold">
              {points.length > 0 ? `${minLatencyMs}ms / ${maxLatencyMs}ms` : '—'}
            </span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-emerald-400 font-semibold">{fastCount} Fast (&le;1s)</span>
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-rose-400 font-semibold">{slowOrTimeoutCount} Slow/Timeout</span>
          </div>
        </div>
      </div>

      {/* Hovered Task Callout Bar */}
      {hoveredPoint && (
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/95 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="text-emerald-400 font-bold">
              Task #{hoveredPoint.sequenceIndex}
            </span>
            <span>·</span>
            <span>
              JL {hoveredPoint.mouzaJlNo} — {hoveredPoint.mouzaNameEn} ({hoveredPoint.mouzaNameBn})
            </span>
            <span>·</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {hoveredPoint.surveyType}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Avg Latency:{' '}
              <strong className="text-emerald-400">
                {hoveredPoint.averageLatencyMs}ms
              </strong>
            </span>
            <span>
              Raw Task:{' '}
              <strong className="text-sky-300">{hoveredPoint.latencyMs}ms</strong>
            </span>
            <span>
              HTTP:{' '}
              <strong
                className={
                  hoveredPoint.httpStatus === 200
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              >
                {hoveredPoint.httpStatus}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* D3 SVG Canvas */}
      <div className="w-full overflow-hidden rounded-lg bg-slate-950/80 border border-slate-900">
        <svg
          ref={svgRef}
          data-testid="d3-latency-trend-svg"
          className="w-full h-[230px] block select-none"
          role="img"
          aria-label="Average Fetch Latency (ms) over the last 50 tasks"
        />
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono-tabular text-slate-400 pt-0.5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />
            <span>Rolling Average Fetch Latency (ms)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-400 inline-block rounded border-b border-dashed" />
            <span>Individual Task Fetch Latency (ms)</span>
          </span>
        </div>
        <div>
          <span>Window: Last {maxTasks} Executed Tasks · Hover any node to inspect Mouza &amp; HTTP telemetry</span>
        </div>
      </div>
    </div>
  );
};
