const Express = require('express')
const bodyParser = require('body-parser')
const db = require('./db')
const open = require('open')
const _ = require('lodash')
const fs = require('fs')
const compression = require('compression')
const path = require('path')
const config = require('./config')
let app = new Express()
app.use(compression())
app.use(bodyParser.json())
// 数据展示接口
app.use('/api/list', async (req, res) => {
  let list = await db.find({})
  let filter = req.query
  // 过滤
  let result = list.filter(function (item) {
    const price = item.priceParsed.price
    if (!item.hasPath){
      return Number(price) > Number(filter.price[0])
          && Number(price) < Number(filter.price[1])
    }
    let duration = -1
    if (filter.pathType === '0'){
      if (item.pathRide !== undefined){
        duration = item.pathRide.duration
      }
      else{
        return Number(price) > Number(filter.price[0])
            && Number(price) < Number(filter.price[1])
      }
    }
    if (filter.pathType === '1') {
      if (item.pathTransitGroup !== undefined && item.pathTransitGroup.length > 0){
        duration = _.minBy(item.pathTransitGroup, 'duration').duration
      }
      else{
        return Number(price) > Number(filter.price[0])
            && Number(price) < Number(filter.price[1])
      }
    }
    else if(filter.pathType === '2') {
      if (item.pathWalking !== undefined){
        duration = item.pathWalking.duration
      }
      else{
        return Number(price) > Number(filter.price[0])
            && Number(price) < Number(filter.price[1])
      }
    }
    return Number(price) > Number(filter.price[0])
        && Number(price) < Number(filter.price[1])
        && Number(duration) > Number(filter.duration[0]*60)
        && Number(duration) < Number(filter.duration[1]*60)
  })
  result.forEach((item, idx, arr) => {
    // 骑行的时长和距离
    if (item.pathRide) {
      item.pathRide = {
        distance: item.pathRide.distance,
        duration: item.pathRide.duration
      }
    }
    // 公交时长和基本路线
    if (item.pathTransitGroup) {
      item.pathTransitGroup = item.pathTransitGroup.map((path) => {
        path.calcDuration = 0 // 多步的总和实际相加(一般会小于百度地图给出的总时长)
        path.steps = path.steps.map(step => {
          const stepItem = step[0]  // 一个步骤多个方案 取第一个
          path.calcDuration += stepItem.duration
          return {
            type: stepItem.vehicle_info.type, // 大类
            detailType: stepItem.vehicle_info.detail && stepItem.vehicle_info.detail.type, // 详细类型
            duration: stepItem.duration, // 本步用时
          }
        })
        return path
      })
    }
  })
  res.send({
    list: result,
    countAll: list.length,
    countFilter: result.length,
    destinationString: config.destinationString
  })
})
// 数据展示首页
app.use('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

// 判断 traineddata 训练数据, 用于 tesseract.js 识别
if (!fs.existsSync('eng.traineddata')) {
  console.error('tesseract.js 需要训练数据\n手动下载: https://github.com/naptha/tessdata/blob/gh-pages/3.02/eng.traineddata.gz 并解压为 eng.traineddata')
  console.log('或者: wget https://github.com/naptha/tessdata/raw/gh-pages/3.02/eng.traineddata.gz && gunzip eng.traineddata.gz')
  process.exit()
}

// 启动服务
app.listen(config.port, (e) => {
  if (e) {
    console.log(e)
  } else {
    open('http://localhost:' + config.port)
  }
})

// 爬取
async function startSpider () {
  const search = require('./search')
  await search.loop(true, config.keywordsArray[0])
}
if (config.crawl){
  startSpider() 
}
