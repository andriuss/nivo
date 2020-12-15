import { useCallback, useMemo } from 'react'
import {
    positionFromAngle,
    radiansToDegrees,
    PropertyAccessor,
    usePropertyAccessor,
    useTheme,
} from '@nivo/core'
import { InheritedColorConfig, useInheritedColor } from '@nivo/colors'
import { Arc, DatumWithArc, DatumWithArcAndColor, Point } from './types'
import { getNormalizedAngle } from './utils'

export interface ArcLink {
    side: 'before' | 'after'
    points: [Point, Point, Point]
}

export interface ArcLinkWithDatum<Datum extends DatumWithArc> extends ArcLink {
    data: Datum
}

/**
 * Compute the link of a single arc, returning its points,
 * please not that points coordinates are relative to
 * the center of the arc.
 */
export const computeArcLink = (
    arc: Arc,
    offset: number,
    diagonalLength: number,
    straightLength: number
): ArcLink => {
    const centerAngle = getNormalizedAngle(
        arc.startAngle + (arc.endAngle - arc.startAngle) / 2 - Math.PI / 2
    )
    const point0: Point = positionFromAngle(centerAngle, arc.outerRadius + offset)
    const point1: Point = positionFromAngle(centerAngle, arc.outerRadius + offset + diagonalLength)

    let side: ArcLink['side']
    let point2: Point
    if (centerAngle < Math.PI / 2 || centerAngle > Math.PI * 1.5) {
        side = 'after'
        point2 = {
            x: point1.x + straightLength,
            y: point1.y,
        }
    } else {
        side = 'before'
        point2 = {
            x: point1.x - straightLength,
            y: point1.y,
        }
    }

    return {
        side,
        points: [point0, point1, point2],
    }
}

/**
 * Compute links for an array of data containing arcs.
 *
 * This is typically used to create labels for arcs.
 */
export const useArcLinks = <
    Datum extends DatumWithArc,
    ExtraProps extends Record<string, any> = Record<string, any>
>({
    data,
    skipAngle = 0,
    offset = 0.5,
    diagonalLength,
    straightLength,
    computeExtraProps = () => ({} as ExtraProps),
}: {
    data: Datum[]
    // arcs with a length below this (end angle - start angle in degrees)
    // are gonna be excluded, this can be typically used to avoid having
    // overlapping labels.
    skipAngle?: number
    // offset from arc outer radius in pixels
    offset?: number
    // length of the diagonal segment of the link
    diagonalLength: number
    // length of the straight segment of the link
    straightLength: number
    // this can be used to append extra properties to the links,
    // can be used to compute a color/label for example.
    computeExtraProps?: (datum: ArcLinkWithDatum<Datum>) => ExtraProps
}): (ArcLinkWithDatum<Datum> & ExtraProps)[] => {
    const links = useMemo(
        () =>
            data
                // filter out arcs with a length below `skipAngle`
                .filter(
                    datum =>
                        Math.abs(radiansToDegrees(datum.arc.endAngle - datum.arc.startAngle)) >=
                        skipAngle
                )
                // compute the link for each eligible arc
                .map(datum => ({
                    ...computeArcLink(datum.arc, offset, diagonalLength, straightLength),
                    data: datum,
                })),
        [data, skipAngle, offset, diagonalLength, straightLength]
    )

    // splitting memoization of links and extra props can be more efficient,
    // this way if only `computeExtraProps` changes, we skip links computation.
    return useMemo(
        () =>
            links.map(link => ({
                ...computeExtraProps(link),
                ...link,
            })),
        [links, computeExtraProps]
    )
}

export interface ArcLinkLabel<Datum extends DatumWithArcAndColor> extends ArcLinkWithDatum<Datum> {
    x: number
    y: number
    label: string
    linkColor: string
    textAnchor: 'start' | 'end'
    textColor: string
}

/**
 * Compute arc link labels, please note that the datum should
 * contain a color in order to be able to compute the link/label text color.
 *
 * Please see `useArcLinks` for a more detailed explanation
 * about the parameters.
 */
export const useArcLinkLabels = <Datum extends DatumWithArcAndColor>({
    data,
    skipAngle,
    offset,
    diagonalLength,
    straightLength,
    textOffset = 0,
    label,
    linkColor,
    textColor,
}: {
    data: Datum[]
    skipAngle?: number
    offset?: number
    diagonalLength: number
    straightLength: number
    textOffset: number
    label: PropertyAccessor<Datum, string>
    linkColor: InheritedColorConfig<Datum>
    textColor: InheritedColorConfig<Datum>
}) => {
    const getLabel = usePropertyAccessor<Datum, string>(label)

    const theme = useTheme()
    const getLinkColor = useInheritedColor<Datum>(linkColor, theme)
    const getTextColor = useInheritedColor<Datum>(textColor, theme)

    const computeExtraProps = useCallback(
        (link: ArcLinkWithDatum<Datum>) => {
            const position = {
                x: link.points[2].x,
                y: link.points[2].y,
            }
            let textAnchor: ArcLinkLabel<Datum>['textAnchor']
            if (link.side === 'before') {
                position.x -= textOffset
                textAnchor = 'end'
            } else {
                position.x += textOffset
                textAnchor = 'start'
            }

            return {
                ...position,
                label: getLabel(link.data),
                linkColor: getLinkColor(link.data),
                textAnchor,
                textColor: getTextColor(link.data),
            }
        },
        [getLabel, getLinkColor, getTextColor]
    )

    return useArcLinks<Datum, Omit<ArcLinkLabel<Datum>, keyof ArcLinkWithDatum<Datum>>>({
        data,
        skipAngle,
        offset,
        diagonalLength,
        straightLength,
        computeExtraProps,
    })
}
