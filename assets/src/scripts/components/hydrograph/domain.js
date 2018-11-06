import { extent, ticks } from 'd3-array';
import { format } from 'd3-format';
import { createSelector } from 'reselect';
import { mediaQuery } from '../../utils';
import config from '../../config';
import { visiblePointsSelector } from './drawingData';
import { getCurrentParmCd } from '../../selectors/timeSeriesSelector';


const PADDING_RATIO = 0.2;
const Y_TICK_COUNT = 5;
// array of parameters that should use
// a symlog scale instead of a linear scale
export const SYMLOG_PARMS = [
    '00060',
    '72137'
];

/**
 *  Return domain padded on both ends by paddingRatio.
 *  For positive domains, a zero-lower bound on the y-axis is enforced.
 *  @param {Array} domain - array of two numbers
 *  @param {Boolean} lowerBoundPOW10 - using log scale
 *  @return {Array} - array of two numbers
 */
export const extendDomain = function (domain, lowerBoundPOW10) {
    const isPositive = domain[0] >= 0 && domain[1] >= 0;
    let extendedDomain;

    // Pad domains on both ends by PADDING_RATIO.
    const padding = PADDING_RATIO * (domain[1] - domain[0]);
    extendedDomain = [
        domain[0] - padding,
        domain[1] + padding
    ];

    // Log scales lower-bounded by nearest power of 10 (10, 100, 1000, etc)
    if (lowerBoundPOW10) {
        extendedDomain = [
            isPositive ? Math.pow(10, Math.floor(Math.log10(domain[0]))) : domain[0],
            extendedDomain[1]
        ];
    }

    // For positive domains, a zero-lower bound on the y-axis is enforced.
    return [
        isPositive ? Math.max(0, extendedDomain[0]) : extendedDomain[0],
        extendedDomain[1]
    ];
};


export const getYDomain = function (pointArrays, currentVarParmCd) {
    let yExtent;
    let scaleDomains = [];

    // Calculate max and min for data
    for (const points of pointArrays) {
        if (points.length === 0) {
            continue;
        }
        const finitePts = points.map(pt => pt.value).filter(val => isFinite(val));
        let ptExtent = extent(finitePts);
        if (ptExtent[0] === ptExtent[1]) {
            // when both the lower and upper values of
            // extent are the same, the domain of the
            // extent is from -Infinity to +Infinity;
            // this isn't useful for creation of data
            // points, so add this broadens the extent
            // a bit for single point series
            ptExtent = [ptExtent[0] - ptExtent[0]/2, ptExtent[0] + ptExtent[0]/2];
        }
        scaleDomains.push(ptExtent);
    }
    if (scaleDomains.length > 0) {
        const flatDomains = [].concat(...scaleDomains).filter(val => isFinite(val));
        if (flatDomains.length > 0) {
            yExtent = [Math.min(...flatDomains), Math.max(...flatDomains)];
        }
    }
    // Add padding to the extent and handle empty data sets.
    if (yExtent) {
        yExtent = extendDomain(yExtent, SYMLOG_PARMS.indexOf(currentVarParmCd) > -1);
    } else {
        yExtent = [0, 1];
    }

    return yExtent;
};


/**
 * Helper function that finds highest negative value (or lowest positive value) in array of tick values, then returns
 * that number's absolute value
 * @param {array} tickValues, the list of y-axis tick values
 * @returns {number} lowestAbsoluteValueOfTicks, the lowest absolute value of the tick values
 */
export const getLowestAbsoluteValueOfTickValues = function(tickValues) {
    let lowestAbsoluteValueOfTicks;

    // if tickValues have negative numbers, pull them out and test them to find the (largest negative) smallest absolute value
    if (tickValues.some(value => value < 0)) {
        let negativeTickValues = tickValues.filter(value => value < 0);
        let highestNegativeValueOfTicks = Math.max(...negativeTickValues);
        lowestAbsoluteValueOfTicks = Math.abs(highestNegativeValueOfTicks);
    } else {
        lowestAbsoluteValueOfTicks = Math.min(...tickValues);
    }

    return lowestAbsoluteValueOfTicks;
};

/**
 * Helper function that generates roughly equally spaced tick values by taking the previous value and dividing it by 2
 * to produce the next lower value
 * @param {number}lowestTickValueOfLogScale, lowest numerical value of positive y-axis values, or lowest absolute
 * value of negative y-axis values
 * @returns {array} additionalTickValues, set of new y-axis tick values that will fill tick mark gaps on log scale graphs
 */
export const generateAdditionalTickValues = function(lowestTickValueOfLogScale) {
    let additionalTickValues = [];
    while (lowestTickValueOfLogScale > 2) {
        lowestTickValueOfLogScale = Math.ceil(lowestTickValueOfLogScale / 2);
        additionalTickValues.push(lowestTickValueOfLogScale);
    }
    return additionalTickValues;
};

/**
 * Helper function that rounds numerical values in an array based on the numerical value of the individual array item
 * and a somewhat arbitrary numeric (rounding) value. The value in the array is then rounded to a multiple of the
 * arbitrary numeric rounding value.
 * @param {array} additionalTickValues, numerical values for y-axis ticks
 * @returns {array} roundedTickValues, numerical values for y-axis ticks rounded to a multiple of a given number
 */
export const getRoundedTickValues = function(additionalTickValues) {
    let roundedTickValues = [];
    // round the values based on an arbitrary breakpoints and rounding targets (may result in duplicate array values)
    additionalTickValues.forEach(function(value) {
        if (value > 1000) {
            value = Math.ceil(value/1000)*1000;
            roundedTickValues.push(value);
        } if (value > 100) {
            value = Math.ceil(value/100)*100;
            roundedTickValues.push(value);
        } else {
            value = Math.ceil(value/5)*5;
            roundedTickValues.push(value);
        }
    });

    // remove values that are duplicates
    roundedTickValues = Array.from(new Set(roundedTickValues));

    return roundedTickValues;
};


/**
 * Helper function that checks where the x-axis intersects the y-axis, keeps any additional tick marks with
 * values above the point of intersection and ignores the rest.
 * @param {array} additionalTickValues, numerical values for y-axis ticks
 * @param {array} yDomain, an array of two points, the lower and upper extent of the y-axis
 * @returns {array} tickValuesAboveXaxis, numerical values for y-axis ticks with any value below the y-axis removed
 */
export const removeTickValuesBelowXaxis = function(additionalTickValues, yDomain) {
    let tickValuesAboveXaxis = [];

    for (let value of additionalTickValues) {
        if (value > yDomain[0]) {
           tickValuesAboveXaxis.push(value);
        }
    }

    return tickValuesAboveXaxis;
};


/**
 *  Helper function that, when negative values are present on the y-axis, adds additional negative values to the set of
 *  tick values used to fill tick mark value gaps on the y-axis on some log scale graphs
 * @param {array} additionalTickValues, a set of tick mark values
 * @returns {array} additionalTickValues, a set of tick mark values with (when needed) additional negative values
 */
export const generateNegativeTicks = function(tickValues, additionalTickValues) {
    if (tickValues.some(value => value < 0)) {
        let tickValueArrayWithNegatives = additionalTickValues.map(x => x * -1);
        additionalTickValues = tickValueArrayWithNegatives.concat(additionalTickValues);
    }

    return additionalTickValues;
};


/**
 * Function creates a new set of tick values that will fill in gaps in log scale ticks, then combines this new set with the
 * original set of tick marks.
 * @param {array} tickValues, the list of y-axis tick values
 * @returns {array} fullArrayOfTickMarks, the new full array of tick marks for log scales
 */
export const getArrayOfAdditionalTickMarks = function(tickValues, yDomain) {
    let additionalTickValues = [];
    // get the lowest value of generated tick mark set to use as a starting point for the additional ticks
    let lowestTickValueOfLogScale = getLowestAbsoluteValueOfTickValues(tickValues);

    // Make a set of tick values that when graphed will have equal spacing on the y axis
    additionalTickValues = generateAdditionalTickValues(lowestTickValueOfLogScale);

    // round the values to a chosen multiple of a number
    additionalTickValues = getRoundedTickValues(additionalTickValues);

    // remove any tick values that would be below the y-axis
    additionalTickValues = removeTickValuesBelowXaxis(additionalTickValues, yDomain);

    // if the log scale has negative values, add additional negative ticks with negative labels
    additionalTickValues = generateNegativeTicks(tickValues, additionalTickValues);

   return additionalTickValues.concat(tickValues);
};


/**
 * Helper function which generates y tick values for a scale
 * @param {Array} yDomain - Two element array representing the domain on the yscale.
 * @param {Array} parmCd - parameter code for time series that is being generated.
 * @returns {Array} of tick values
 */
export const getYTickDetails = function (yDomain, parmCd) {
    const isSymlog = SYMLOG_PARMS.indexOf(parmCd) > -1;

    let tickValues = ticks(yDomain[0], yDomain[1], Y_TICK_COUNT);

    // add additional ticks and labels to log scales as needed
    if (isSymlog) {
        tickValues = getArrayOfAdditionalTickMarks(tickValues, yDomain);
    }

    // On small screens, log scale ticks are too close together, so only use every other one.
    if (isSymlog && tickValues.length > 3 && !mediaQuery(config.USWDS_MEDIUM_SCREEN)) {
        tickValues = tickValues.filter((_, index) => index % 2);
    }

    // If all ticks are integers, don't display right of the decimal place.
    // Otherwise, format with two decimal points.
    const tickFormat = tickValues.filter(t => !Number.isInteger(t)).length ? '.2f' : 'd';
    return {
        tickValues,
        tickFormat: format(tickFormat)
    };
};


const yDomainSelector = createSelector(
    visiblePointsSelector,
    getCurrentParmCd,
    getYDomain
);


export const tickSelector = createSelector(
    yDomainSelector,
    getCurrentParmCd,
    getYTickDetails
);
