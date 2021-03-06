import {brushX} from 'd3-brush';
import {event} from 'd3-selection';
import {createStructuredSelector} from 'reselect';

import {appendXAxis} from '../../../d3-rendering/axes';
import {link} from '../../../lib/d3-redux';
import {getDVGraphBrushOffset} from '../../selectors/daily-value-time-series-selector';
import {Actions} from '../../store/daily-value-time-series';

import {getXAxis} from './selectors/axes';
import {getBrushLayout} from './selectors/layout';
import {getBrushXScale, getBrushYScale} from './selectors/scales';
import {getCurrentTimeSeriesSegments} from './selectors/time-series-data';

import {drawDataSegments} from './time-series-graph';

/*
 * Renders a brush element within container for the daily value graph
 * @param {D3 selection} container
 * @param {Redux store} store
 */
export const drawGraphBrush = function(container, store) {

    const brushed = function() {
        if (!event.sourceEvent || event.sourceEvent.type === 'zoom') {
            return;
        }
        const xScale = getBrushXScale(store.getState());
        const brushRange = event.selection || xScale.range();

        // Only about the main hydrograph when user is done adjusting the time range.
        if (event.sourceEvent.type === 'mouseup' || event.sourceEvent.type === 'touchend') {

            const adjustedBrush = brushRange.map(xScale.invert, xScale);

            store.dispatch(Actions.setDVGraphBrushOffset(adjustedBrush[0]- xScale.domain()[0], xScale.domain()[1] - adjustedBrush[1]));
        }
    };

    const div = container.append('div')
        .attr('class', 'hydrograph-container');
    div.append('svg')
        .classed('brush-svg', true)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .call(link(store,(elem, layout) => {
                elem.attr('viewBox', `0 0 ${layout.width + layout.margin.left + layout.margin.right} ${layout.height + layout.margin.bottom + layout.margin.top}`);
            }, getBrushLayout
            ))
        .call(svg => {
            svg.append('g')
                .call(link(store,(elem, layout) => elem.attr('transform', `translate(${layout.margin.left},${layout.margin.top})`),
                                getBrushLayout
                ))
                .call(link(store, appendXAxis, createStructuredSelector({
                    xAxis: getXAxis('BRUSH'),
                    layout: getBrushLayout
                })))
                .call(link(store, drawDataSegments, createStructuredSelector({
                    segments: getCurrentTimeSeriesSegments,
                    xScale: getBrushXScale,
                    yScale: getBrushYScale,
                    enableClip: () => false
                })));
        })
        .call(link(store, (svg, {layout, graphBrushOffset, xScale}) => {
            let selection;

            const graphBrush = brushX()
                .on('brush end', brushed);

            svg.select('.brush').remove();

            const group = svg.append('g').attr('class', 'brush')
                .attr('transform', `translate(${layout.margin.left},${layout.margin.top})`);

            graphBrush.extent([[0, 0], [layout.width - layout.margin.right, layout.height - layout.margin.bottom - layout.margin.top]]);

            // Creates the brush
            group.call(graphBrush);

             // Fill & round corners of brush handles
            svg.selectAll('.handle').classed('brush-handle-fill', true)
                .attr('rx',15).attr('ry',15);

            if (graphBrushOffset) {
                const [startMillis, endMillis] = xScale.domain();
                selection = [
                    xScale(startMillis + graphBrushOffset.start),
                    xScale(endMillis - graphBrushOffset.end)
                ];
            } else {
                selection = xScale.range();
            }

            graphBrush.move(group, selection);

        }, createStructuredSelector({
            layout: getBrushLayout,
            graphBrushOffset: getDVGraphBrushOffset,
            xScale: getBrushXScale
        })));
};
