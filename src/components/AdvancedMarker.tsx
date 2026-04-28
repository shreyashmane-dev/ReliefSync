import React, { useEffect, useRef } from 'react';

interface AdvancedMarkerProps {
    map?: google.maps.Map | null;
    position: google.maps.LatLngLiteral;
    title?: string;
    children?: React.ReactNode;
    onClick?: () => void;
    draggable?: boolean;
    onDragEnd?: (position: google.maps.LatLngLiteral) => void;
}

/**
 * A custom component to use the new Google Maps AdvancedMarkerElement.
 * This is required to resolve the deprecation warnings of google.maps.Marker.
 */
export const AdvancedMarker: React.FC<AdvancedMarkerProps> = ({
    map,
    position,
    title,
    children,
    onClick,
    draggable = false,
    onDragEnd,
}) => {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement) return;

        // If children are provided, we use them as the marker's content
        let content: HTMLElement | undefined = undefined;
        if (children && contentRef.current) {
            content = contentRef.current;
        }

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content,
            gmpDraggable: draggable,
        });

        const clickListener = marker.addListener('gmp-click', () => {
            if (onClick) onClick();
        });
        const dragEndListener = marker.addListener('dragend', () => {
            const currentPosition = marker.position;
            if (!onDragEnd || !currentPosition) return;

            if (typeof currentPosition.lat === 'function' && typeof currentPosition.lng === 'function') {
                onDragEnd({ lat: currentPosition.lat(), lng: currentPosition.lng() });
                return;
            }

            onDragEnd({
                lat: Number(currentPosition.lat),
                lng: Number(currentPosition.lng),
            });
        });

        markerRef.current = marker;

        return () => {
            clickListener.remove();
            dragEndListener.remove();
            marker.map = null;
        };
    }, [map, position, title, children, onClick, draggable, onDragEnd]);

    // We render the children into a hidden div, which is then picked up by the marker
    return children ? <div ref={contentRef} style={{ display: 'none' }}>{children}</div> : null;
};
