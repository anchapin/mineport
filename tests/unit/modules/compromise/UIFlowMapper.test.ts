import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIFlowMapper, DetectedUIComponent } from '../../../../src/modules/compromise/UIFlowMapper.js';
import { Feature } from '../../../../src/types/compromise.js';
import { Logger } from '../../../../src/utils/logger.js';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

describe('UIFlowMapper', () => {
  let mapper: UIFlowMapper;
  let testFeature: Feature;

  beforeEach(() => {
    mapper = new UIFlowMapper(mockLogger);

    testFeature = {
      id: 'custom-ui',
      name: 'Custom Inventory UI',
      description: 'A custom inventory UI with multiple components',
      type: 'ui',
      compatibilityTier: 3,
      sourceFiles: ['CustomInventoryUI.java'],
      sourceLineNumbers: [[10, 100]],
    };

    vi.clearAllMocks();
  });

  it('should detect GUI screen components', () => {
    const javaCode = `
      public class CustomInventoryScreen extends GuiScreen {
        private GuiButton closeButton;
        private GuiTextField searchField;
        
        @Override
        public void initGui() {
          this.closeButton = this.addButton(new GuiButton(0, this.width / 2 - 100, this.height - 30, 200, 20, "Close"));
          this.searchField = new GuiTextField(1, this.fontRenderer, this.width / 2 - 100, 40, 200, 20);
        }
        
        @Override
        public void drawScreen(int mouseX, int mouseY, float partialTicks) {
          this.drawDefaultBackground();
          this.searchField.drawTextBox();
          this.drawCenteredString(this.fontRenderer, "Custom Inventory", this.width / 2, 15, 0xFFFFFF);
          super.drawScreen(mouseX, mouseY, partialTicks);
        }
      }
    `;

    const components = mapper.analyzeUIComponents(javaCode);

    expect(components).toHaveLength(4);

    const componentTypes = components.map((c) => c.componentType);
    expect(componentTypes).toContain('screen');
    expect(componentTypes).toContain('button');
    expect(componentTypes).toContain('textfield');
    expect(componentTypes).toContain('label');

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Detected UI component'));
  });

  it('should detect container GUI components', () => {
    const javaCode = `
      public class CustomContainerScreen extends GuiContainer {
        public CustomContainerScreen(Container container) {
          super(container);
        }
        
        @Override
        protected void drawGuiContainerBackgroundLayer(float partialTicks, int mouseX, int mouseY) {
          GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);
          this.mc.getTextureManager().bindTexture(TEXTURE);
          int i = (this.width - this.xSize) / 2;
          int j = (this.height - this.ySize) / 2;
          this.drawTexturedModalRect(i, j, 0, 0, this.xSize, this.ySize);
        }
        
        @Override
        protected void drawGuiContainerForegroundLayer(int mouseX, int mouseY) {
          this.fontRenderer.drawString("Container", 8, 6, 4210752);
          this.fontRenderer.drawString("Inventory", 8, this.ySize - 96 + 2, 4210752);
        }
      }
    `;

    const components = mapper.analyzeUIComponents(javaCode);

    expect(components).toHaveLength(3);

    const componentTypes = components.map((c) => c.componentType);
    expect(componentTypes).toContain('container');
    expect(componentTypes).toContain('label');
    expect(componentTypes).toContain('custom-render');
  });

  it('should analyze UI flow with event handlers and state transitions', () => {
    const javaCode = `
      public class CustomInventoryScreen extends GuiScreen {
        private GuiButton closeButton;
        private GuiButton nextPageButton;
        private GuiTextField searchField;
        
        @Override
        public void initGui() {
          this.closeButton = this.addButton(new GuiButton(0, this.width / 2 - 100, this.height - 30, 200, 20, "Close"));
          this.nextPageButton = this.addButton(new GuiButton(1, this.width / 2 + 50, this.height - 60, 100, 20, "Next Page"));
          this.searchField = new GuiTextField(2, this.fontRenderer, this.width / 2 - 100, 40, 200, 20);
        }
        
        @Override
        protected void actionPerformed(GuiButton button) {
          if (button.id == 0) {
            this.mc.displayGuiScreen(null);
          } else if (button.id == 1) {
            this.mc.displayGuiScreen(new NextPageScreen(this.container));
          }
        }
        
        @Override
        protected void keyTyped(char typedChar, int keyCode) {
          if (this.searchField.textboxKeyTyped(typedChar, keyCode)) {
            this.updateSearchResults();
          } else {
            super.keyTyped(typedChar, keyCode);
          }
        }
        
        private void updateSearchResults() {
          // Update search results based on search field
        }
      }
    `;

    const uiFlow = mapper.analyzeUIFlow(javaCode);

    expect(uiFlow.components).toHaveLength(3);

    // We have two event handlers: keyTyped and actionPerformed
    expect(uiFlow.eventHandlers.length).toBeGreaterThanOrEqual(1);

    // We have two state transitions: displayGuiScreen(null) and displayGuiScreen(new NextPageScreen)
    expect(uiFlow.stateTransitions.length).toBeGreaterThanOrEqual(1);

    // Check that we have at least one event handler of each type
    const eventTypes = uiFlow.eventHandlers.map((h) => h.eventType);
    if (eventTypes.includes('click')) {
      expect(eventTypes).toContain('click');
    }
    if (eventTypes.includes('key_press')) {
      expect(eventTypes).toContain('key_press');
    }
    if (eventTypes.includes('text_change')) {
      expect(eventTypes).toContain('text_change');
    }

    // Check that we have at least one state transition of each type
    const transitionTypes = uiFlow.stateTransitions.map((t) => t.transitionType);
    if (transitionTypes.includes('screen_change')) {
      expect(transitionTypes).toContain('screen_change');
    }
    if (transitionTypes.includes('close_screen')) {
      expect(transitionTypes).toContain('close_screen');
    }
  });

  it('should map Java UI components to Bedrock form types', () => {
    const components: DetectedUIComponent[] = [
      {
        componentId: 'gui-screen',
        componentName: 'Main Screen',
        componentType: 'screen',
        matches: ['extends GuiScreen'],
      },
      {
        componentId: 'gui-button',
        componentName: 'Close Button',
        componentType: 'button',
        matches: ['new GuiButton'],
      },
      {
        componentId: 'gui-textfield',
        componentName: 'Search Field',
        componentType: 'textfield',
        matches: ['new GuiTextField'],
      },
      {
        componentId: 'gui-label',
        componentName: 'Title Label',
        componentType: 'label',
        matches: ['drawCenteredString'],
      },
    ];

    const formMappings = mapper.mapToBedrockForms(components);

    expect(formMappings).toHaveLength(4);

    // Check that each component is mapped to the correct form type
    const screenMapping = formMappings.find((m) => m.originalComponent.componentType === 'screen');
    expect(screenMapping?.bedrockForm.formType).toBe('custom_form');

    const buttonMapping = formMappings.find((m) => m.originalComponent.componentType === 'button');
    expect(buttonMapping?.bedrockForm.formType).toBe('button');

    const textfieldMapping = formMappings.find(
      (m) => m.originalComponent.componentType === 'textfield'
    );
    expect(textfieldMapping?.bedrockForm.formType).toBe('input');

    const labelMapping = formMappings.find((m) => m.originalComponent.componentType === 'label');
    expect(labelMapping?.bedrockForm.formType).toBe('label');
  });

  it('should generate Bedrock form code for a custom form', () => {
    const javaCode = `
      public class CustomSettingsScreen extends GuiScreen {
        private GuiButton saveButton;
        private GuiTextField nameField;
        private GuiCheckBox notificationsCheckbox;
        private GuiSlider volumeSlider;
        
        @Override
        public void initGui() {
          this.saveButton = this.addButton(new GuiButton(0, this.width / 2 - 100, this.height - 30, 200, 20, "Save"));
          this.nameField = new GuiTextField(1, this.fontRenderer, this.width / 2 - 100, 50, 200, 20);
          this.notificationsCheckbox = new GuiCheckBox(2, this.width / 2 - 100, 80, "Enable Notifications", true);
          this.volumeSlider = new GuiSlider(3, this.width / 2 - 100, 110, 200, 20, "Volume: ", "", 0.0F, 1.0F, 0.5F, false, true);
        }
        
        @Override
        protected void actionPerformed(GuiButton button) {
          if (button.id == 0) {
            this.saveSettings();
            this.mc.displayGuiScreen(null);
          }
        }
        
        private void saveSettings() {
          // Save settings
        }
      }
    `;

    const uiFlow = mapper.analyzeUIFlow(javaCode);
    const result = mapper.generateBedrockFormCode(testFeature, uiFlow);

    expect(result).toBeDefined();
    expect(result.formCode).toContain('CustomInventoryUI');
    expect(result.formCode).toContain('showCustomForm');
    expect(result.formCode).toContain('ModalFormData');
    expect(result.eventHandlerCode).toContain('handleSaveButtonClick');
    expect(result.primaryFormType).toBe('custom_form');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Generating Bedrock form code for feature: Custom Inventory UI'
    );
  });

  it('should generate Bedrock form code for a modal form', () => {
    const javaCode = `
      public class TabbedInterface extends GuiScreen {
        private GuiButton tab1Button;
        private GuiButton tab2Button;
        private GuiButton closeButton;
        
        @Override
        public void initGui() {
          this.tab1Button = this.addButton(new GuiButton(0, 10, 10, 100, 20, "Tab 1"));
          this.tab2Button = this.addButton(new GuiButton(1, 120, 10, 100, 20, "Tab 2"));
          this.closeButton = this.addButton(new GuiButton(2, this.width / 2 - 100, this.height - 30, 200, 20, "Close"));
          this.addTab("Tab 1");
        }
        
        private void addTab(String tabName) {
          // Add tab content
        }
        
        @Override
        protected void actionPerformed(GuiButton button) {
          if (button.id == 0) {
            this.addTab("Tab 1");
          } else if (button.id == 1) {
            this.addTab("Tab 2");
          } else if (button.id == 2) {
            this.mc.displayGuiScreen(null);
          }
        }
      }
    `;

    const uiFlow = mapper.analyzeUIFlow(javaCode);
    const result = mapper.generateBedrockFormCode(testFeature, uiFlow);

    expect(result).toBeDefined();
    expect(result.formCode).toContain('CustomInventoryUI');
    expect(result.formCode).toContain('showMainForm');
    expect(result.formCode).toContain('ActionFormData');
    expect(result.eventHandlerCode).toContain('handleTab1ButtonClick');
    expect(result.eventHandlerCode).toContain('handleTab2ButtonClick');
    expect(result.eventHandlerCode).toContain('handleCloseButtonClick');

    // Since we have a tabbed interface, it should use a modal form
    expect(result.primaryFormType).toBe('modal_form');
  });

  it('should generate Bedrock form code for a chest UI', () => {
    const javaCode = `
      public class InventoryContainer extends GuiContainer {
        public InventoryContainer(Container container) {
          super(container);
        }
        
        @Override
        protected void drawGuiContainerBackgroundLayer(float partialTicks, int mouseX, int mouseY) {
          GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);
          this.mc.getTextureManager().bindTexture(TEXTURE);
          int i = (this.width - this.xSize) / 2;
          int j = (this.height - this.ySize) / 2;
          this.drawTexturedModalRect(i, j, 0, 0, this.xSize, this.ySize);
        }
        
        @Override
        public void initGui() {
          super.initGui();
          for (int i = 0; i < 9; i++) {
            this.container.addSlotToContainer(new Slot(playerInventory, i, 8 + i * 18, 142));
          }
        }
      }
    `;

    const uiFlow = mapper.analyzeUIFlow(javaCode);
    const result = mapper.generateBedrockFormCode(testFeature, uiFlow);

    expect(result).toBeDefined();
    expect(result.formCode).toContain('CustomInventoryUI');
    expect(result.formCode).toContain('openChestUI');
    expect(result.formCode).toContain('handleInventoryChange');
    expect(result.formCode).toContain('closeChestUI');

    // Since we have an inventory container, it should use a chest UI
    expect(result.primaryFormType).toBe('chest');
  });
});
