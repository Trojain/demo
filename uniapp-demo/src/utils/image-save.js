export function saveNetworkImageToAlbum(imageUrl) {
  if (!imageUrl) {
    return Promise.reject(new Error('图片地址为空'))
  }

  return new Promise((resolve, reject) => {
    uni.showLoading({
      title: '保存中',
      mask: true
    })

    uni.downloadFile({
      url: imageUrl,
      success: (downloadRes) => {
        const statusCode = downloadRes.statusCode || 0
        const tempFilePath = downloadRes.tempFilePath

        if (statusCode < 200 || statusCode >= 300 || !tempFilePath) {
          reject(new Error('图片下载失败'))
          return
        }

        uni.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: (saveRes) => {
            uni.showToast({
              title: '已保存到相册',
              icon: 'success'
            })
            resolve(saveRes)
          },
          fail: (saveError) => {
            uni.showModal({
              title: '保存失败',
              content: '请确认已授权保存图片到相册',
              showCancel: false
            })
            reject(saveError)
          }
        })
      },
      fail: (downloadError) => {
        reject(downloadError)
      },
      complete: () => {
        uni.hideLoading()
      }
    })
  })
}

export function saveNetworkVideoToAlbum(videoUrl) {
  if (!videoUrl) {
    return Promise.reject(new Error('视频地址为空'))
  }

  return new Promise((resolve, reject) => {
    uni.showLoading({
      title: '保存中',
      mask: true
    })

    uni.downloadFile({
      url: videoUrl,
      success: (downloadRes) => {
        const statusCode = downloadRes.statusCode || 0
        const tempFilePath = downloadRes.tempFilePath

        if (statusCode < 200 || statusCode >= 300 || !tempFilePath) {
          reject(new Error('视频下载失败'))
          return
        }

        // 保存视频依赖各小程序平台的相册权限，失败时保留日志方便真机排查。
        uni.saveVideoToPhotosAlbum({
          filePath: tempFilePath,
          success: (saveRes) => {
            uni.showToast({
              title: '已保存到相册',
              icon: 'success'
            })
            resolve(saveRes)
          },
          fail: (saveError) => {
            uni.showModal({
              title: '保存失败',
              content: '请确认已授权保存视频到相册',
              showCancel: false
            })
            reject(saveError)
          }
        })
      },
      fail: (downloadError) => {
        reject(downloadError)
      },
      complete: () => {
        uni.hideLoading()
      }
    })
  })
}
