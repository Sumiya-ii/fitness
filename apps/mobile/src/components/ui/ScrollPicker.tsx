import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '../../theme';

export interface ScrollPickerItem {
  label: string;
  value: number | string;
}

export interface ScrollPickerProps {
  items: ScrollPickerItem[];
  selectedValue: number | string;
  onValueChange: (value: number | string) => void;
  itemHeight?: number;
  visibleItems?: number;
  width?: number;
  accessibilityLabel?: string;
}

/**
 * Snap-to-item vertical scroll picker.
 * The selected item is centred in the visible window and highlighted;
 * surrounding items are progressively faded and shrunk.
 */
export function ScrollPicker({
  items,
  selectedValue,
  onValueChange,
  itemHeight = 48,
  visibleItems = 5,
  width,
  accessibilityLabel,
}: ScrollPickerProps) {
  const c = useColors();
  const listRef = useRef<FlatList>(null);

  // How many empty padding slots we need above/below so the first and last
  // real item can sit in the centre slot.
  const paddingCount = Math.floor(visibleItems / 2);

  // Build the padded item array once.
  const paddedItems = useMemo(() => {
    const pad: (ScrollPickerItem | null)[] = Array(paddingCount).fill(null);
    return [...pad, ...items, ...pad];
  }, [items, paddingCount]);

  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.value === selectedValue),
    [items, selectedValue],
  );

  // Scroll to the current selection on mount and whenever selectedValue
  // changes programmatically (e.g. when items list changes).
  useEffect(() => {
    if (selectedIndex < 0) return;
    // Use a small timeout so the list has laid out before we scroll.
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: false,
      });
    }, 50);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const snappedIndex = Math.round(offsetY / itemHeight);
      const clampedIndex = Math.max(0, Math.min(snappedIndex, items.length - 1));

      if (items[clampedIndex] && items[clampedIndex].value !== selectedValue) {
        Haptics.selectionAsync();
        onValueChange(items[clampedIndex].value);
      }
    },
    [itemHeight, items, onValueChange, selectedValue],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight],
  );

  const containerHeight = itemHeight * visibleItems;

  const renderItem = useCallback(
    ({ item, index }: { item: ScrollPickerItem | null; index: number }) => {
      // Convert padded-list index to the real item's distance from the selected item.
      const realIndex = index - paddingCount;
      const distance = Math.abs(realIndex - selectedIndex);

      let opacity: number;
      let textStyle: string;

      if (distance === 0) {
        opacity = 1.0;
        textStyle = 'text-[20px] font-sans-bold text-text';
      } else if (distance === 1) {
        opacity = 0.4;
        textStyle = 'text-[16px] font-sans-medium text-text';
      } else {
        opacity = 0.2;
        textStyle = 'text-[13px] font-sans text-text';
      }

      return (
        <View
          style={{ height: itemHeight }}
          className="items-center justify-center"
          accessibilityElementsHidden={item === null}
        >
          <Text className={textStyle} style={{ opacity }}>
            {item?.label ?? ''}
          </Text>
        </View>
      );
    },
    [itemHeight, paddingCount, selectedIndex],
  );

  const keyExtractor = useCallback((_: unknown, index: number) => String(index), []);

  // The centre-indicator lines sit exactly at the top and bottom edges of the
  // selected item slot.  They are rendered as absolute-positioned siblings.
  const indicatorTop = itemHeight * paddingCount;
  const indicatorBottom = indicatorTop + itemHeight;

  return (
    <View
      style={{ height: containerHeight, width: width ?? undefined }}
      className={width ? undefined : 'flex-1'}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: items[selectedIndex]?.label }}
    >
      {/* Scroll list */}
      <FlatList
        ref={listRef}
        data={paddedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        // Prevent the FlatList from intercepting parent scroll events.
        nestedScrollEnabled
      />

      {/* Centre selection indicator — two thin lines around the selected slot */}
      <View
        className="absolute left-0 right-0 pointer-events-none"
        style={{ top: indicatorTop, height: 1, backgroundColor: c.border }}
      />
      <View
        className="absolute left-0 right-0 pointer-events-none"
        style={{ top: indicatorBottom - 1, height: 1, backgroundColor: c.border }}
      />
    </View>
  );
}
