import * as React from 'react';
import { Panel, PanelType, Nav, DefaultButton, PrimaryButton } from 'office-ui-fabric-react';

import { ILinkPickerPanel, ILinkPickerChoice } from './ILinkPickerPanel';
import { ILinkPickerPanelProps, LinkType } from './ILinkPickerPanelProps';
import { ILinkPickerPanelState, NavState, ApprovedImage } from './ILinkPickerPanelState';

import styles from './LinkPickerPanel.module.scss';
import { strings } from '../loc/en-us';

import { SPHttpClient, SPHttpClientResponse, HttpClientResponse } from '@microsoft/sp-http';
import { Thenable } from 'es6-promise';

const imageJsonConfigLocation = "/SiteAssets/ApprovedImageLibs.config";

export default class LinkPickerPanel
  extends React.Component<ILinkPickerPanelProps, ILinkPickerPanelState>
  implements ILinkPickerPanel {

  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      navState: NavState.site,
      isUrlValid: false,
      url: "",
      showImageTab: false,
      images: [],
      imageLibs: []
    };

    this.props.webPartContext.spHttpClient.get(imageJsonConfigLocation, SPHttpClient.configurations.v1).then((response: HttpClientResponse) => {
      this.setState({ showImageTab: response.status === 200 });
    }).catch(() => {
      this.setState({ showImageTab: false });
    });
  }

  public render(): JSX.Element {

    // Figure out which UI to show based on the navigation state
    const showDocPickerIFrame =
      this.state.navState == NavState.site;
    const showLinkEntryForm =
      this.state.navState == NavState.link;
    const showImageEntryForm =
      this.state.navState == NavState.image;

    return (

      <Panel isOpen={this.state.isOpen}
        onDismissed={this.removeMessageListener.bind(this)}
        className={styles["link-picker"]}
        hasCloseButton={false}
        type={PanelType.extraLarge}
        isLightDismiss={true}
        onDismiss={this.onCancelButtonClick.bind(this)}>

        {/* Navigation on left of panel */}
        {this.state.showImageTab &&
          <Nav selectedKey={this.state.navState.toString()} isOnTop={true} initialSelectedKey={NavState.site.toString()}
            groups={[{
              links: [
                {
                  name: strings.LinkPickerSiteNav,
                  icon: "Globe", key: NavState.site.toString(), url: "#",
                  onClick: this.onSiteNavClick.bind(this),
                  isExpanded: showDocPickerIFrame
                },
                {
                  name: strings.LinkPickerLinkNav,
                  icon: "Link", key: NavState.link.toString(), url: "#",
                  onClick: this.onLinkNavClick.bind(this),
                  isExpanded: showLinkEntryForm
                },
                {
                  name: strings.LinkPickerImageNav,
                  icon: "Photo2", key: NavState.image.toString(), url: "#",
                  onClick: this.onImageNavClick.bind(this),
                  isExpanded: showImageEntryForm
                }
              ]
            }]} />
        }
        {!this.state.showImageTab &&
          <Nav selectedKey={this.state.navState.toString()} isOnTop={true} initialSelectedKey={NavState.site.toString()}
            groups={[{
              links: [
                {
                  name: strings.LinkPickerSiteNav,
                  icon: "Globe", key: NavState.site.toString(), url: "#",
                  onClick: this.onSiteNavClick.bind(this),
                  isExpanded: showDocPickerIFrame
                },
                {
                  name: strings.LinkPickerLinkNav,
                  icon: "Link", key: NavState.link.toString(), url: "#",
                  onClick: this.onLinkNavClick.bind(this),
                  isExpanded: showLinkEntryForm
                }
              ]
            }]} />
        }

        {/* Doc picker iFrame or link entry form */}
        <div className={styles["tabs"]}>

          <div hidden={!showDocPickerIFrame}>
            <iframe src={this.getDocPickerUrl()} role="application" title={strings.LinkPickerSelectFromSiteTitle} />
          </div>

          <div hidden={!showLinkEntryForm} className={styles["link-insert"]}>
            <h2>{strings.LinkPickerSelectFromLinkLabel}</h2>
            <label htmlFor="linkUrl">{strings.LinkPickerSelectFromLinkDescription}</label><br />
            <textarea id="linkUrl" aria-label={strings.LinkPickerSelectFromLinkDescription} onChange={this.onLinkTextChange.bind(this)} defaultValue={this.state.url} />
            <div className={styles["buttons"]}>
              <PrimaryButton disabled={!this.state.isUrlValid} onClick={this.onOkButtonClick.bind(this)}>{strings.LinkPickerSelectButtonText}</PrimaryButton>
              <DefaultButton onClick={this.onCancelButtonClick.bind(this)}>{strings.LinkPickerCancelButtonText}</DefaultButton>
            </div>
          </div>

          <div hidden={!showImageEntryForm}>
            <div className={styles['imageCont']}>
              {this.state.images &&
                this.state.images.map((item) => {
                  return (
                    <div className={styles['imageItem']} key={"item-" + this.state.images.indexOf(item)} onClick={this.onImageSelect.bind(this)} data-index={this.state.images.indexOf(item)}>
                      <img src={item.Thumbnail} />
                      <p>{item.Name}</p>
                    </div>
                  );
                })
              }
            </div>
            <div className={styles["buttons"]}>
              <PrimaryButton disabled={!this.state.isUrlValid} onClick={this.onOkButtonClick.bind(this)}>{strings.LinkPickerSelectButtonText}</PrimaryButton>
              <DefaultButton onClick={this.onCancelButtonClick.bind(this)}>{strings.LinkPickerCancelButtonText}</DefaultButton>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  // ** Open and Close Panel **

  // Promise methods for returning link to caller
  private resolvePickLink: (value?: ILinkPickerChoice | Thenable<ILinkPickerChoice>) => void;
  private rejectPickLink: () => void;

  // Public method to pick a link
  public pickLink(currentUrl: string = ""): Promise<ILinkPickerChoice> {

    //set the current url as the optional input url
    this.setState({
      url: currentUrl,
      isUrlValid: this.isValidLink(currentUrl)
    }, () => {
      this.openLinkPanel();
    });

    return new Promise<ILinkPickerChoice>(
      (resolve, reject) => {
        this.resolvePickLink = resolve;
        this.rejectPickLink = reject;
      });
  }

  private openLinkPanel() {
    //and message listener for document selection iFrame  
    this.addMessageListener();

    //set state to open link picker and set proper pane
    this.setState({
      isOpen: true,
      navState: this.state.url ? NavState.link : NavState.site,
      //isUrlValid: false, //no need to reset the valid state as already set
      //url: "" //no need to reset the url in state, already set
    });
  }

  private closeLinkPanel() {
    this.removeMessageListener();
    this.setState({
      isOpen: false,
    });
  }

  // ** Functions to manage the document selection iFrame **

  private addMessageListener() {
    addEventListener('message', this.onMessageReceived.bind(this), false);
  }

  private removeMessageListener() {
    removeEventListener('message', this.onMessageReceived.bind(this), false);
  }

  private onMessageReceived(event: React.CompositionEvent<HTMLIFrameElement>) {
    if (event.data.indexOf('[OneDrive-FromPicker]', 0) === 0) {
      const json = JSON.parse(event.data.replace('[OneDrive-FromPicker]', ''));
      const eventType = json.type;

      switch (eventType) {
        case 'success':
          const name: string = json.items[0].name;
          const url: string = json.items[0].sharePoint.url;
          this.resolvePickLink({ name: name, url: url });
          this.closeLinkPanel();
          break;
        case 'cancel':
          this.rejectPickLink();
          this.closeLinkPanel();
          break;
      }
    }
  }

  private getDocPickerUrl() {
    const anchor = document.createElement('a');
    anchor.href = this.props.webAbsUrl;

    let typeFilter = '&view=2&p=2';
    if (this.props.linkType != LinkType.all) {
      typeFilter += '&typeFilters=';
      if (this.props.linkType & LinkType.folder) typeFilter += 'folder,';
      if (this.props.linkType & LinkType.doc) typeFilter += '.doc,.docx,.docm,.xls,.xlsx,.xlsm,.pot,.potx,.ppt,.pptx,.pptm,.vsdx,.vsdm,.vsd,.pdf,';
      if (this.props.linkType & LinkType.image) typeFilter += '.gif,.jpg,.jpeg,.bmp,.dib,.tif,.tiff,.ico,.png,.jxr,';
      if (this.props.linkType & LinkType.page) typeFilter += '.aspx,';
      if (this.props.linkType & LinkType.developer) typeFilter += '.html,.css,.handlebars,.js,.json,.ts,.tsx,.jsx,.less,.scss,.sass';
      typeFilter = typeFilter.slice(0, -1);   // Trim trailing comma
    }
    typeFilter += '&picker={"sn":false,"v":"files","id":"1","o":"';

    return anchor.href +
      "/_layouts/15/onedrive.aspx?id=" +
      (anchor.pathname.substring(0, 1) === '/' ? "" : "/") +
      anchor.pathname +
      typeFilter +
      anchor.hostname +
      '","s":"single"}';
  }

  //Function to get the libraries where image previews will be loaded from.
  private getImageLibraries() {
    this.props.webPartContext.spHttpClient.get(imageJsonConfigLocation, SPHttpClient.configurations.v1).then((response: HttpClientResponse) => {
      response.json().then((results) => {
        this.setState({ imageLibs: results });
        this.getApprovedImages();
      });
    });
  }

  //Function to return url's of approved images
  //TODO: allow >1 location of featured images and make configurable
  private getApprovedImages() {
    const images: Array<ApprovedImage> = [];

    if (this.state.imageLibs.length > 0) {
      this.state.imageLibs.forEach((library) => {
        const libSourceString = library.libUrl.substr(0, library.libUrl.indexOf("/_api/"));
        this.props.webPartContext.spHttpClient.get(library.libUrl, SPHttpClient.configurations.v1)
          .then((response: SPHttpClientResponse) => {
            response.json().then((results) => {
              results.value.forEach(value => {
                const item: ApprovedImage = new ApprovedImage();
                item.RelativeURL = value.FieldValuesAsText.FileRef;
                item.Name = value.FieldValuesAsText.FileLeafRef;
                //RESERVE for a time when the CDN can handle scaling.
                //item.Thumbnail =  library.cdnUrl + value.FieldValuesAsText.FileLeafRef;
                //this.props.webAbsUrl
                const tmp = this.props.webAbsUrl;
                item.Thumbnail = libSourceString +
                  "/_layouts/15/getpreview.ashx?resolution=0&clientMode=modernWebPart&path=" +
                  window.location.origin +
                  value.FieldValuesAsText.FileRef;
                images.push(item);
              });
              this.setState({ images: images });
            });
          });
      });
    }
  }

  // ** UI Event Handlers **

  // <Nav> event handlers
  private onSiteNavClick(event: React.MouseEvent<HTMLElement>) {
    this.onNavClick(NavState.site, event);
  }

  private onLinkNavClick(event: React.MouseEvent<HTMLElement>) {
    this.onNavClick(NavState.link, event);
  }

  private onImageNavClick(event: React.MouseEvent<HTMLElement>) {
    this.onNavClick(NavState.image, event);
    this.getImageLibraries();
  }

  private onNavClick(navState: NavState, event: React.MouseEvent<HTMLElement>) {

    event.stopPropagation();
    event.preventDefault();

    this.setState(
      {
        navState: navState
      }
    );
    return false;
  }

  // Link entry form
  private onLinkTextChange(event: React.FormEvent<HTMLTextAreaElement>) {
    this.setState({
      url: event.currentTarget.value,
      isUrlValid: this.isValidLink(event.currentTarget.value)
    });
  }

  private onOkButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    this.resolvePickLink({ name: "", url: this.state.url });
    this.closeLinkPanel();
  }

  private onCancelButtonClick() {
    this.rejectPickLink();
    this.closeLinkPanel();
  }

  // Image entry form
  private onImageSelect(event: React.FormEvent<HTMLDivElement>) {
    const elements = document.querySelectorAll("." + styles["imageCont"] + " ." + styles["imageItem"]);
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].getAttribute("is-selected"))
        elements[i].removeAttribute("is-selected");
    }
    event.currentTarget.setAttribute("is-selected", "true");
    const linkTarget = this.state.images[event.currentTarget.attributes['data-index'].value].Thumbnail;
    if (linkTarget != undefined) {
      this.setState({
        url: linkTarget,
        isUrlValid: this.isValidLink(linkTarget)
      });
    }
  }

  // ** Validation  **
  private isValidLink(url: string) {
    const httpUrlRegex = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    const dataUrlRegex = /^\s*data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)?)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s]*)\s*$/i;

    return httpUrlRegex.test(url) ||
      ((this.props.linkType | LinkType.image) && dataUrlRegex.test(url));
  }
}
