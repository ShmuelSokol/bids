-- dbo.shipment_1_view



/* view shipment_1_view: add view */


/* view shipment_1_view: add view */


/* view shipment_1_view: add view */

/* view shipment_1_view: add view */


/* view shipment_1_view: add view */


/* view shipment_1_view: add view */


/* view shipment_1_view: add view */


/* view shipment_1_view: add view */


/* view shipment_1_view: add view */


/* view shipment_1_view: add view */
/* view shipment_1_view: add view 
 view shipment_1_view: add view 
 view shipment_1_view: add view 
 view shipment_1_view: add view 
 view shipment_1_view: add view 
 view shipment_1_view: add view 
 view shipment_1_view: add view 
 view shipment_1_view: add view */
CREATE VIEW [dbo].[shipment_1_view]
AS
SELECT        Kaj_tab.shp_id_kaj, K79_tab.cntrct_k79, K80_tab.rel_no_k80, K81_tab.clinno_k81, Ka9_tab.jln_no_ka9, Kaj_tab.shpnum_kaj, Kaj_tab.packed_kaj, Kaj_tab.shpsta_kaj, K79_tab.idnk79_k79, K80_tab.idnk80_k80, 
                         K81_tab.idnk81_k81, Ka9_tab.idnka9_ka9, Ka9_tab.idnkae_ka9, Kaj_tab.idnkaj_kaj, K80_tab.piidno_k80
FROM            dbo.k79_tab AS K79_tab INNER JOIN
                         dbo.k80_tab AS K80_tab ON K79_tab.idnk79_k79 = K80_tab.idnk79_k80 INNER JOIN
                         dbo.k81_tab AS K81_tab ON K80_tab.idnk80_k80 = K81_tab.idnk80_k81 INNER JOIN
                         dbo.ka9_tab AS Ka9_tab ON K81_tab.idnk81_k81 = Ka9_tab.idnk81_ka9 INNER JOIN
                         dbo.kaj_tab AS Kaj_tab ON Ka9_tab.idnkaj_ka9 = Kaj_tab.idnkaj_kaj










