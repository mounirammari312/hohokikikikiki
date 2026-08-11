import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Centralized scroll-restoration for route changes.
 *
 * Behaviour:
 *  - Pathname change (e.g. / -> /shop)            => scroll to top instantly
 *  - Pathname change WITH hash #order              => let target page handle it
 *  - Pathname change WITH other hash               => smooth-scroll to element
 *  - Same path, only search change (?cat=, ?q=)    => DO NOT scroll (preserves
 *                                                     user's browsing position)
 *  - Same path, hash #order change                 => let ProductDetail handle
 *  - Same path, other hash change                  => smooth-scroll to element
 *
 * Without this component mounted, navigating from a long page (e.g. Home scrolled
 * down to the categories section) to a shorter page (e.g. /shop) leaves the
 * browser at the bottom of the new page — which is the bug the user reported
 * ("عند النقر على اي فئة تفتح الصفحة مباشرة في ذيل الصفحة").
 */
export default function ScrollToTop(){
  const { pathname, hash, search } = useLocation()
  const prev = useRef({ pathname, hash, search })

  useEffect(()=>{
    const prevPath = prev.current.pathname
    const prevHash = prev.current.hash
    const isPathChange = pathname !== prevPath
    const isHashChange = hash !== prevHash

    if(isPathChange){
      // If navigating to a hash like #order, let the target page handle it
      // (ProductDetail has its own useEffect that scrolls the form into view).
      if(hash === '#order'){
        prev.current = { pathname, hash, search }
        return
      }
      if(hash){
        const id = hash.replace('#','')
        // wait a tick for DOM to render
        requestAnimationFrame(()=>{
          const el = document.getElementById(id)
          if(el){
            el.scrollIntoView({behavior:'smooth', block:'start'})
          } else {
            window.scrollTo({top:0, left:0, behavior:'auto'})
          }
        })
      } else {
        // Instant scroll on route change — smooth scrolling here feels laggy
        // and can be confusing when navigating between pages.
        window.scrollTo({top:0, left:0, behavior:'auto'})
      }
    } else if(isHashChange && hash){
      // Same page hash change (e.g. product#order)
      if(hash === '#order'){
        // handled by ProductDetail
        prev.current = { pathname, hash, search }
        return
      }
      const id = hash.replace('#','')
      requestAnimationFrame(()=>{
        const el = document.getElementById(id)
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'})
      })
    }
    // search-only changes (?q=, ?cat=, ?variant=) => DO NOT SCROLL
    prev.current = { pathname, hash, search }
  }, [pathname, hash, search])

  return null
}
