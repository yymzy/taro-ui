import classNames from 'classnames'
import PropTypes, { InferProps } from 'prop-types'
import React from 'react'
import Taro from '@tarojs/taro'
import { Text, View, MovableArea, MovableView } from '@tarojs/components'
import { CommonEvent } from '@tarojs/components/types/common'
import {
  AtSwipeActionProps,
  AtSwipeActionState,
  SwipeActionOption
} from '../../../types/swipe-action'
import { uuid, delayGetClientRect } from '../../common/utils'
import AtSwipeActionOptions from './options/index'

export default class AtSwipeAction extends React.Component<
  AtSwipeActionProps,
  AtSwipeActionState
> {
  public static defaultProps: AtSwipeActionProps
  public static propTypes: InferProps<AtSwipeActionProps>

  private moveX: number
  private delayTime: NodeJS.Timeout

  public constructor(props: AtSwipeActionProps) {
    super(props)
    const { isOpened } = props
    this.state = {
      componentId: uuid(),
      // eslint-disable-next-line no-extra-boolean-cast
      offsetSize: 0,
      _isOpened: !!isOpened,
      needAnimation: false,
      eleWidth: 0,
      maxOffsetSize: 0
    }
    this.moveX = this.state.offsetSize
  }

  public componentDidMount(): void {
    this.getAreaWidth()
  }

  // 当 eleWidth 发生变化时，需要重新计算 maxOffsetSize
  public componentDidUpdate(_, prevState: AtSwipeActionState): void {
    const { eleWidth } = this.state
    if (prevState.eleWidth !== eleWidth) {
      this.getMaxOffsetSize()
    }
  }

  public UNSAFE_componentWillReceiveProps(nextProps: AtSwipeActionProps): void {
    const { isOpened } = nextProps
    const { _isOpened, maxOffsetSize } = this.state

    if (isOpened !== _isOpened) {
      clearTimeout(this.delayTime);
      this.moveX = isOpened ? 0 : maxOffsetSize
      this._reset(!!isOpened) // TODO: Check behavior
    }
  }

  /**
   * 获取滑块区域与options操作区域选择器
   */
  private getSelectorStr(type: string): string {
    const { componentId } = this.state
    const { parentSelector } = this.props
    return (parentSelector && (process.env.TARO_ENV === 'weapp' || process.env.TARO_ENV === 'tt') ? `${parentSelector} >>> ` : '') + `#${type}-${componentId}`
  }

  /**
   * 获取滑动区域宽度
   */
  private async getAreaWidth(): Promise<void> {
    const actionRect = await delayGetClientRect({
      selectorStr: this.getSelectorStr('swipeAction')
    })

    let eleWidth = actionRect[0].width

    if (!eleWidth) {
      const systemInfo = await Taro.getSystemInfo()
      eleWidth = systemInfo.windowWidth;
    }

    this.setState({
      eleWidth
    })
  }

  /**
   * 获取最大偏移量
   */
  private async getMaxOffsetSize(): Promise<void> {
    const actionOptionsRect = await delayGetClientRect({
      selectorStr: this.getSelectorStr('swipeActionOptions'),
    })

    const maxOffsetSize = actionOptionsRect[0].width

    this.setState({
      maxOffsetSize
    })
  }

  private _reset(isOpened: boolean, then: () => void = () => { }): void {
    this.setState({
      offsetSize: this.moveX
    }, () => {
      this.moveX = 0;
      Taro.nextTick(() => {
        if (isOpened) {
          const { maxOffsetSize } = this.state
          if (process.env.TARO_ENV === 'jd') {
            this.setState({
              _isOpened: true,
              offsetSize: -maxOffsetSize + 0.01
            }, then)
          } else {
            this.setState({
              _isOpened: true,
              offsetSize: -maxOffsetSize
            }, then)
          }
        } else {
          this.setState({
            offsetSize: 0,
            _isOpened: false
          }, then)
        }
      })
    })
  }

  private handleOpened = (event: CommonEvent): void => {
    const { onOpened } = this.props
    if (typeof onOpened === 'function') {
      onOpened(event)
    }
  }

  private handleClosed = (event: CommonEvent): void => {
    const { onClosed } = this.props
    if (typeof onClosed === 'function') {
      onClosed(event)
    }
  }

  private handleClick = (
    item: SwipeActionOption,
    index: number,
    event: CommonEvent
  ): void => {
    const { onClick, autoClose } = this.props

    if (typeof onClick === 'function') {
      onClick(item, index, event)
    }
    if (autoClose) {
      this._reset(false, () => {
        this.handleClosed(event)
      }) // TODO: Check behavior
    }
  }

  onTouchEnd = e => {
    clearTimeout(this.delayTime);
    this.delayTime = setTimeout(() => {
      const { maxOffsetSize } = this.state
      if (Math.abs(this.moveX) < maxOffsetSize / 2) {
        this._reset(false, () => {
          this.handleClosed(e)
        })
      } else {
        this._reset(true, () => {
          this.handleOpened(e)
        })
      }
    }, 10);
  }

  onChange = e => {
    this.moveX = e.detail.x
  }

  public render(): JSX.Element {
    const { componentId, maxOffsetSize, eleWidth, offsetSize } = this.state
    const { options, disabled } = this.props
    const rootClass = classNames('at-swipe-action', this.props.className)

    const areaWidth = eleWidth > 0 ? `${eleWidth}px` : '100%'

    return (
      <View
        id={`swipeAction-${componentId}`}
        className={rootClass}
        style={{
          width: areaWidth
        }}
      >
        <MovableArea
          className='at-swipe-action__area'
          style={{
            width: areaWidth
          }}
        >
          <MovableView
            className='at-swipe-action__content'
            direction='horizontal'
            damping={50}
            x={offsetSize}
            onTouchEnd={this.onTouchEnd}
            onChange={this.onChange}
            disabled={disabled}
            style={{
              width: `${eleWidth + maxOffsetSize}px`
            }}
          >
            <View
              style={{
                width: areaWidth
              }}
            >
              {this.props.children}
            </View>
            {Array.isArray(options) && options.length > 0 ? (
              <AtSwipeActionOptions
                options={options}
                componentId={componentId}
                customStyle={{
                  opacity: maxOffsetSize ? 1 : 0
                }}
              >
                {options.map((item, key) => (
                  <View
                    key={`${item.text}-${key}`}
                    style={item.style}
                    onClick={(e): void => this.handleClick(item, key, e)}
                    className={classNames(
                      // @ts-ignore
                      'at-swipe-action__option',
                      item.className
                    )}
                  >
                    <Text className='option__text'>{item.text}</Text>
                  </View>
                ))}
              </AtSwipeActionOptions>
            ) : null}
          </MovableView>
        </MovableArea>
      </View>
    )
  }
}

AtSwipeAction.defaultProps = {
  options: [],
  isOpened: false,
  disabled: false,
  autoClose: false,
  maxDistance: 0,
  areaWidth: 0
}

AtSwipeAction.propTypes = {
  isOpened: PropTypes.bool,
  disabled: PropTypes.bool,
  autoClose: PropTypes.bool,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string,
      style: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
      className: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.string,
        PropTypes.array
      ])
    })
  ),

  onClick: PropTypes.func,
  onOpened: PropTypes.func,
  onClosed: PropTypes.func
}
