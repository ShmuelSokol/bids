-- dbo.shipment_ext_trans_ctl_1_view



/* view shipment_ext_trans_ctl_1_view: add view */


/* view shipment_ext_trans_ctl_1_view: add view */


/* view shipment_ext_trans_ctl_1_view: add view */

/* view shipment_ext_trans_ctl_1_view: add view */


/* view shipment_ext_trans_ctl_1_view: add view */


/* view shipment_ext_trans_ctl_1_view: add view */


/* view shipment_ext_trans_ctl_1_view: add view */
CREATE VIEW [dbo].[shipment_ext_trans_ctl_1_view]
AS
SELECT        Kaj_tab.idnkaj_kaj, Kaj_tab.shpnum_kaj, Kaj_tab.packed_kaj, Kaj_tab.podcod_kaj, Kaj_tab.poecod_kaj, Kaj_tab.bolnum_kaj, Kaj_tab.insdte_kaj, Kaj_tab.edi_id_kaj, Kaj_tab.t_mode_kaj, Kaj_tab.shptme_kaj, 
                         Kaj_tab.shpsta_kaj, Kaj_tab.trakno_kaj, Kaj_tab.pkg_wt_kaj, Kaj_tab.wawuid_kaj, Kaj_tab.bxxcnt_kaj, Kaj_tab.boxcnt_kaj, Kaj_tab.shpdes_kaj, Kaj_tab.idnkbg_kaj, Kbr_tab.idnkbr_kbr, Kbr_tab.xtcscn_kbr, 
                         Kbr_tab.xtcsta_kbr, Kbr_tab.xtctme_kbr, Kap_tab.idnkap_kap, Kap_tab.catitl_kap, Kaj_tab.uptime_kaj
FROM            dbo.kaj_tab AS Kaj_tab INNER JOIN
                         dbo.kbr_tab AS Kbr_tab ON Kaj_tab.idnkaj_kaj = Kbr_tab.idnitt_kbr INNER JOIN
                         dbo.kap_tab AS Kap_tab ON Kbr_tab.idnkap_kbr = Kap_tab.idnkap_kap
WHERE        (Kbr_tab.itttbl_kbr = 'kaj')







