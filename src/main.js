// 创建虚拟dom元素 将jsx转化为虚拟dom元素
// 示例

// const element=React.createElement(
//     "p",
//     {className:"class"},
//     "你好"
// )
const createElement = (type, props, ...children) => {
    return {
        type,
        props: {
            ...props,
            children: children.map(item =>
                typeof item === "object" ? item : createTextElement(item)
            )
        }
    }
}
// 转换为文本元素的虚拟Dom元素
const createTextElement = (text) => {
    return {
        type: "TEXT_ELEMENT", // 文本元素
        props: {
            nodeValue: text, // 文本节点值
            children: []
        }
    }
}
//  并将虚拟dom元素渲染到实际的dom元素中 将实际dom元素插入container中
const render = (element, container) => {
    // fiber根节点
    const wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot,// 更新比较
    }
    deletions: [] // 需要追踪删除的元素
    nextUnitOfWork = wipRoot // 下一个处理的工作是这个根节点
}


let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null

// 工作流程入口函数
const workLoop = (deadline) => {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        // 如果deadline.timeRemaining()<1 也就是浏览器没有空余时间 那么中断循环 
        // 浏览器去执行其他任务
        shouldYield = deadline.timeRemaining() < 1
    }
    // 当wiproot fiber 构建完成  进入commit 阶段
    if (wipRoot && !nextUnitOfWork) {
        commitRoot()
    }
    requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)  // 浏览器空闲时间调用
// 根据不同函数组件调用更新不同函数 以及 节点处理
const performUnitOfWork = (fiber) => {
    const isFunctionComponent = fiber.type instanceof Function
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }
    // 处理子节点
    if (fiber.child) {
        return fiber.child
    }
    // 如果没子节点了，返回兄弟节点或者叔节点
    let nextFiber = fiber
    while (nextFiber) {
        // 兄弟节点
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        // 叔节点
        nextFiber = nextFiber.parent
    }
}
// 函数组件
let wipFiber = null
let hookIndex = null
const updateFunctionComponent = (fiber) => {
    // 函数组件的处理
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    // 执行函数组件 获取子元素
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}
// 主机组件
const updateHostComponent = (fiber) => {
    // dom元素组件的处理
    if (!fiber.dom) {
        // 创建真实dom节点
        fiber.dom = createDom(fiber)
    }
    reconcileChildren(fiber, fiber.props.children)
}
// 创建dom节点
const createDom = (fiber) => {
    // 判断fiber是否为文本节点 不是的话创建普通元素节点
    const dom =
        fiber.type == "TEXT_ELEMENT"
            ? document.createTextNode('')
            : document.createElement(fiber.type)
    // 给普通元素节点 注入属性 
    updateDom(dom, {}, fiber.props)
    return dom
}
// 判断是否为事件  如果是on开头 则为事件
const isEvent = key => key.startsWith('on')
const isProperty = key => key != "children" && !isEvent(key)
const isNew = (prev, next) => key => prev.key !== next.key
const isGone = (prev, next) => key => !(key in next)
// 将属性注入到dom上
const updateDom = (dom, prevprops, nextprops) => {
    // 移除旧的监听器
    Object.keys(prevprops) // 获取当前preprops所有属性名
        .filter(isEvent)   // 过滤获取当前所有事件的属性名
        .filter(key => !(key in nextprops) || // 过滤不存在nextprops的属性
            isNew(prevprops, nextprops)(key)) // 或者存在但是值不相同的属性
        .forEach(name => {
            // 将所有属性名称转小写并从下标为2的字符串截取 onClick=> click
            const eventType = name.toLowerCase().substring(2)
            // 移除
            dom.removeEventListener(
                eventType, // 移除事件属性名
                prevprops[name]// 移除事件处理函数
            )
        })

    // 移除旧的prop普通属性
    Object.keys(prevprops)
        .filter(isProperty)
        .filter(isGone(prevprops, nextprops))
        .forEach(name =>
            dom[name] = ''
        )
    // 插入新的或者更改的属性
    Object.keys(nextprops)
        .filter(isProperty)
        .filter(isNew(prevprops, nextprops))
        .forEach(name =>
            dom[name] = nextprops[name]
        )
    // 增加新的监听器
    Object.keys(nextprops)
        .filter(isEvent)
        .filter(isNew(prevprops, nextprops))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2)
            dom.addEventListener(
                eventType,
                nextprops[name]
            )
        })
}
// 提交fiber节点
const commitRoot = () => {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}
// 对父 子 兄弟节点根据不同的effectTag进行操作
const commitWork = (fiber) => {
    if (!fiber) {
        return
    }
    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom
    if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
        domParent.appendChild(fiber.dom);
    }
    if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    }
    if (fiber.effectTag === "DELETION") {
        commitDeletions(fiber, domParent)
    }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}
const commitDeletions = (fiber, domParent) => {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        // 递归处理删除子节点
        commitDeletions(fiber.child, domParent)
    }

}
// 比较新旧fiber 更新新的fiber  设置插入/更新/删除
const reconcileChildren = (wipFiber, elements) => {
    // 设置元素索引
    let index = 0
    // 获取旧fiber节点
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null
    // 为每个元素执行循环
    while (
        index < elements.length && oldFiber != null
    ) {
        const element = elements[index]
        let newFiber = null
        const sameType = element && oldFiber && element.type == oldFiber.type
        // 更新
        if (sameType) {
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: "UPDATE",
            }
        }
        // 插入
        if (element && !sameType) {
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: "PLACEMENT"
            }

        }
        // 删除
        if (oldFiber && !sameType) {
            oldFiber.effectTag = "DELETION"
            deletions.push(oldFiber)
        }
        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }
        if (index === 0) {
            wipFiber.child = newFiber
        } else if (element) {
            prevSibling.sibling = newFiber
        }
        prevSibling = newFiber
        index++
    }
}
const useState = (initial) => {
    // 获取当前工作的fiber节点
    const oldHooks = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]

    const hook = {
        state: oldHooks ? oldHooks.state : initial,
        queue: [] // 更新操作队列数组
    }
    // 获取旧的更新操作队列
    const actions = oldHooks ? oldHooks.queue : []
    actions.forEach(action =>
        hook.state = action(hook.state)
    )
    const setState = action => {
        // 将新的操作更新添加到更新队列中
        hook.queue.push(action)
        // 更新根fiber节点
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }
    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}
const Didact = {
    createElement,
    render,
    useState
}
// 添加注释：babel会将jsx语法转义为调用react.createElement 实现：jsx=>js
// 由于一些兼容性问题 暂时无法调试成功
/** @jsx Didact.createElement */
const Counter = () => {
    const [state, setState] = Didact.useState(0)
    return (
        <h1 onClick={() => setState(item => item + 1)}>
            Count: {state}
        </h1>
    )
}
const element = <Counter />
const container = document.getElementById('root')
Didact.render(element, container)