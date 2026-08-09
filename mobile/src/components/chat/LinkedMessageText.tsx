import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { segmentTextWithEntities, type DetectedEntity } from '../../links/detect';

interface Props {
  text: string;
  color: string;
  linkColor: string;
  fontSize: number;
  numberOfLines?: number;
  onEntityPress: (entity: DetectedEntity) => void;
}

export function LinkedMessageText({
  text,
  color,
  linkColor,
  fontSize,
  numberOfLines,
  onEntityPress,
}: Props) {
  const segments = useMemo(() => segmentTextWithEntities(text), [text]);

  return (
    <Text style={[styles.text, { color, fontSize }]} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <Text key={`t-${i}`}>{seg.text}</Text>;
        }
        return (
          <Text
            key={`e-${i}-${seg.entity.start}`}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => onEntityPress(seg.entity)}
          >
            {seg.entity.display}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    lineHeight: 22,
  },
});
