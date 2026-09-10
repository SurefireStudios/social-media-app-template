import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ThemePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available theme colors with light and dark variants - brighter and more vibrant
const themeColors = [
  { 
    name: "Red", 
    value: "#ff0000", 
    light: "#ff3333", 
    dark: "#cc0000", 
    className: "bg-red-600" 
  },
  { 
    name: "Orange", 
    value: "#ff7700", 
    light: "#ff9933", 
    dark: "#cc6000", 
    className: "bg-orange-600" 
  },
  { 
    name: "Blue", 
    value: "#0066ff", 
    light: "#3399ff", 
    dark: "#0044cc", 
    className: "bg-blue-600" 
  },
  { 
    name: "Green", 
    value: "#00cc00", 
    light: "#33ff33", 
    dark: "#009900", 
    className: "bg-green-600" 
  },
  { 
    name: "Purple", 
    value: "#9900ff", 
    light: "#cc33ff", 
    dark: "#7700cc", 
    className: "bg-purple-600" 
  },
  { 
    name: "Gray", 
    value: "#555555", 
    light: "#777777", 
    dark: "#333333", 
    className: "bg-gray-600" 
  },
];

const ThemePickerModal = ({ isOpen, onClose }: ThemePickerModalProps) => {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  
  // Get the previously saved color from localStorage on component mount
  useEffect(() => {
    const savedColor = localStorage.getItem('theme_color');
    if (savedColor) {
      setSelectedColor(savedColor);
    } else {
      // Default to red if no color saved
      setSelectedColor("#ff0000");
    }
  }, [isOpen]);
  
  const handleColorSelect = (color: { name: string, value: string }) => {
    setSelectedColor(color.value);
  };
  
  const handleSaveTheme = () => {
    if (!selectedColor) return;
    
    // Find the selected color object by value
    const colorObj = themeColors.find(c => c.value === selectedColor);
    if (!colorObj) return;
    
    // Store the selected color in localStorage
    localStorage.setItem('theme_color', selectedColor);
    localStorage.setItem('theme_color_light', colorObj.light);
    localStorage.setItem('theme_color_dark', colorObj.dark);
    
    // Update theme.json's primary value - not actually possible at runtime,
    // but we'll simulate by setting CSS custom properties
    document.documentElement.style.setProperty('--color-primary', selectedColor);
    document.documentElement.style.setProperty('--color-primary-light', colorObj.light);
    document.documentElement.style.setProperty('--color-primary-dark', colorObj.dark);
    
    // Set primary color for common UI elements
    const primaryElements = document.querySelectorAll('.bg-primary, .text-primary, .border-primary');
    primaryElements.forEach(el => {
      if (el instanceof HTMLElement) {
        if (el.classList.contains('bg-primary')) {
          el.style.backgroundColor = selectedColor;
        }
        if (el.classList.contains('text-primary')) {
          el.style.color = selectedColor;
        }
        if (el.classList.contains('border-primary')) {
          el.style.borderColor = selectedColor;
        }
      }
    });
    
    // Update light and dark variants too
    const primaryLightElements = document.querySelectorAll('.bg-primary-light');
    primaryLightElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.backgroundColor = colorObj.light;
      }
    });
    
    const primaryDarkElements = document.querySelectorAll('.bg-primary-dark');
    primaryDarkElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.backgroundColor = colorObj.dark;
      }
    });
    
    toast({
      title: "Theme updated",
      description: `Theme color changed to ${colorObj.name}`,
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-light text-light border-dark-lighter max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Choose Theme Color</DialogTitle>
          <DialogDescription className="text-gray-400">
            Select a new primary color
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-3 py-4">
          {themeColors.map((color) => (
            <button
              key={color.name}
              className={`flex flex-col items-center justify-center h-24 rounded-lg 
                ${selectedColor === color.value 
                  ? 'border-2 border-white' 
                  : 'border border-dark-lighter hover:border-gray-500'} 
                transition focus:outline-none`}
              style={{ backgroundColor: color.value }}
              onClick={() => handleColorSelect(color)}
            >
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white font-medium">{color.name}</span>
              </div>
            </button>
          ))}
        </div>
        
        <DialogFooter className="flex justify-between mt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-dark-lighter text-light"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveTheme}
            className="bg-primary hover:bg-primary/90 text-white"
            disabled={!selectedColor}
          >
            Save Theme
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ThemePickerModal;