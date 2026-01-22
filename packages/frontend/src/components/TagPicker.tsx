import { useState, useRef, useEffect } from 'react';
import './TagPicker.css';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

interface TagPickerProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  availableTags: Tag[];
  onCreateTag?: (name: string) => Promise<Tag | null>;
  placeholder?: string;
}

export function TagPicker({
  selectedTags,
  onTagsChange,
  availableTags,
  onCreateTag,
  placeholder = 'Search or create tags...'
}: TagPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter available tags based on input and exclude already selected
  const filteredTags = availableTags.filter(
    tag =>
      tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTags.some(selected => selected.id === tag.id)
  );

  // Check if input exactly matches an existing tag
  const exactMatch = availableTags.find(
    tag => tag.name.toLowerCase() === inputValue.toLowerCase()
  );

  // Show "Create" option if no exact match and input has value
  const showCreateOption = inputValue.trim().length > 0 && !exactMatch && onCreateTag;

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTag = (tag: Tag) => {
    if (!selectedTags.some(t => t.id === tag.id)) {
      onTagsChange([...selectedTags, tag]);
    }
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: number) => {
    onTagsChange(selectedTags.filter(tag => tag.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!onCreateTag || !inputValue.trim()) return;

    const newTag = await onCreateTag(inputValue.trim());
    if (newTag) {
      onTagsChange([...selectedTags, newTag]);
      setInputValue('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = filteredTags.length + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex < filteredTags.length) {
          handleSelectTag(filteredTags[highlightedIndex]);
        } else if (showCreateOption) {
          handleCreateTag();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Backspace':
        if (inputValue === '' && selectedTags.length > 0) {
          handleRemoveTag(selectedTags[selectedTags.length - 1].id);
        }
        break;
    }
  };

  return (
    <div className="tag-picker-container" ref={containerRef}>
      <div className="tag-picker-input-area">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="tag-picker-chip"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              borderColor: tag.color
            }}
          >
            <span
              className="tag-picker-chip-dot"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
            <button
              type="button"
              className="tag-picker-chip-remove"
              onClick={() => handleRemoveTag(tag.id)}
              style={{ color: tag.color }}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-picker-input"
          placeholder={selectedTags.length === 0 ? placeholder : ''}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {isOpen && (filteredTags.length > 0 || showCreateOption) && (
        <div className="tag-picker-dropdown">
          {filteredTags.map((tag, index) => (
            <div
              key={tag.id}
              className={`tag-picker-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              onClick={() => handleSelectTag(tag)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span
                className="tag-picker-option-dot"
                style={{ backgroundColor: tag.color }}
              />
              <span className="tag-picker-option-name">{tag.name}</span>
            </div>
          ))}
          {showCreateOption && (
            <div
              className={`tag-picker-option tag-picker-create ${
                highlightedIndex === filteredTags.length ? 'highlighted' : ''
              }`}
              onClick={handleCreateTag}
              onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
            >
              <span className="tag-picker-create-icon">+</span>
              <span>Create "{inputValue.trim()}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
