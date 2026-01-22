import { TAG_COLORS } from '../constants/colors';
import './ColorPicker.css';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ selectedColor, onColorChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {TAG_COLORS.map(color => (
        <button
          key={color.hex}
          type="button"
          className={`color-picker-swatch ${selectedColor === color.hex ? 'selected' : ''}`}
          style={{ backgroundColor: color.hex }}
          onClick={() => onColorChange(color.hex)}
          title={color.name}
        >
          {selectedColor === color.hex && (
            <svg
              className="color-picker-check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
