import { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { GOOGLE_MAPS_API_KEY } from '../lib/config';

interface Props {
  latitude: number;
  longitude: number;
  onMarkerDragEnd?: (lat: number, lng: number) => void;
  height?: number | string;
  draggable?: boolean;
}

export default function GoogleMapsWebView({ latitude, longitude, onMarkerDragEnd, height = '100%', draggable = true }: Props) {
  const webRef = useRef<WebView>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (webRef.current) {
      webRef.current.postMessage(JSON.stringify({ type: 'moveMarker', lat: latitude, lng: longitude }));
    }
  }, [latitude, longitude]);

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; }
      #map { width: 100%; height: 100%; }
    </style>
    <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      let map;
      let marker;
      let dragTimeout;

      function initMap() {
        map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: ${latitude}, lng: ${longitude} },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
        });

        marker = new google.maps.Marker({
          position: { lat: ${latitude}, lng: ${longitude} },
          map: map,
          draggable: ${draggable},
        });

        if (${draggable}) {
          marker.addListener('dragend', function() {
            const pos = marker.getPosition();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'dragEnd',
              lat: pos.lat(),
              lng: pos.lng()
            }));
          });
        }
      }

      window.addEventListener('message', function(e) {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'moveMarker') {
            const newPos = { lat: data.lat, lng: data.lng };
            marker.setPosition(newPos);
            map.panTo(newPos);
          }
        } catch(err) {}
      });

      window.addEventListener('load', initMap);
    </script>
  </body>
  </html>`;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        key={key}
        ref={webRef}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'dragEnd' && onMarkerDragEnd) {
              onMarkerDragEnd(data.lat, data.lng);
            }
          } catch {}
        }}
        javaScriptEnabled
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#f0f0f0' },
});