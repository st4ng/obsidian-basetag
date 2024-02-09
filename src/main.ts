import { App, Plugin, PluginSettingTab, Setting } from "obsidian"
import { createTagNode, updatePropertyTagNodes } from "./renderer"
import { excludeBasetag } from "./utils"

import { ViewPlugin } from "@codemirror/view"
import { LinkTagSelector, PropertyTagContainer } from "./constants"
import TagRenderPlugin from "./renderer"
import { Unsubscribe, observe } from "./utils"

export default class BasetagPlugin extends Plugin {
  public settings: BasetagSettings = DEFAULT_SETTING

  async onload() {
    this.loadSettings()
    this.addSettingTab(new BasetagSettingsTab(this.app, this))

    // Handle tags in editor
    this.registerEditorExtension(
      ViewPlugin.fromClass(TagRenderPlugin, {
        decorations: ({ decorations }) => decorations,
      })
    )

    // Handle tags in read mode
    this.registerMarkdownPostProcessor((el: HTMLElement) => {
      el.querySelectorAll(excludeBasetag(LinkTagSelector)).forEach(
        (node: HTMLAnchorElement) => {
          node.parentNode?.insertBefore(
            createTagNode(node.textContent ?? ""),
            node
          )
          node.remove()
        }
      )
    })

    // Handle tags in properties
    const observers: Unsubscribe[] = []
    const unsubscribeAll = () => {
      observers.forEach((o) => o())
      observers.length = 0
    }
    this.register(unsubscribeAll)
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        unsubscribeAll()
        document
          .querySelectorAll(
            [
              PropertyTagContainer,
              ...(this.settings.customTagContainerSelectors || []),
            ].join(",")
          )
          .forEach((node: HTMLElement) => {
            observers.push(
              observe(
                node,
                () => updatePropertyTagNodes(this.settings.customTagSelectors),
                { subtree: true, childList: true }
              )
            )
          })
        this.updateProperties()
      })
    )
  }

  updateProperties() {
    updatePropertyTagNodes(this.settings.customTagSelectors)
  }

  async loadSettings() {
    this.settings = Object.assign(DEFAULT_SETTING, await this.loadData())
  }
  async saveSettings() {
    await this.saveData(this.settings)
  }
}

interface BasetagSettings {
  customTagSelectors: string[]
  customTagContainerSelectors: string[]
}

const DEFAULT_SETTING: BasetagSettings = {
  customTagSelectors: [],
  customTagContainerSelectors: [],
}

class BasetagSettingsTab extends PluginSettingTab {
  constructor(public app: App, public plugin: BasetagPlugin) {
    super(app, plugin)
  }

  async display() {
    const { settings } = this.plugin
    const { containerEl } = this
    containerEl.empty()

    const addListSetting = (
      name: string,
      desc: string,
      setting: keyof BasetagSettings
    ): Setting =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((text) => {
          text.setValue(settings[setting].join(","))
          text.onChange(async (value) => {
            settings[setting] = value ? value.split(",") : []
            await this.plugin.saveSettings()
          })
        })

    addListSetting(
      "Custom Tag Selector",
      "Additional selectors to custom tag elements (separate by comma)",
      "customTagSelectors"
    )

    addListSetting(
      "Custom Tag Container Selector",
      "Additional selectors to custom tag containers (separate by comma)",
      "customTagContainerSelectors"
    )
  }
}
