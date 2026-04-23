-- dbo.job_line_2_view



/* view job_line_2_view: add view */


/* view job_line_2_view: add view */


/* view job_line_2_view: add view */

/* view job_line_2_view: add view */


/* view job_line_2_view: add view */


/* view job_line_2_view: add view */


/* view job_line_2_view: add view */


/* view job_line_2_view: add view */


/* view job_line_2_view: add view */


/* view job_line_2_view: add view */
/* view job_line_2_view: add view 
 view job_line_2_view: add view 
 view job_line_2_view: add view 
 view job_line_2_view: add view 
 view job_line_2_view: add view 
 view job_line_2_view: add view 
 view job_line_2_view: add view 
 view job_line_2_view: add view */
CREATE VIEW [dbo].[job_line_2_view]
AS
SELECT        K79_tab.cntrct_k79, K80_tab.rel_no_k80, K81_tab.clinno_k81, Ka8_tab.job_no_ka8, Ka9_tab.jln_no_ka9, Ka9_tab.jlndte_ka9, Ka9_tab.jrqpur_ka9, Ka9_tab.jlnqty_ka9, Ka9_tab.jlnsta_ka9, Ka9_tab.jlnsdt_ka9, 
                         Ka9_tab.pinval_ka9, Ka9_tab.xinval_ka9, Ka9_tab.potval_ka9, Ka9_tab.selval_ka9, Ka9_tab.idnk81_ka9, Ka8_tab.idnka8_ka8, Ka9_tab.idnka9_ka9, K81_tab.pr_num_k81, K81_tab.clnqty_k81, 
                         K81_tab.upkqty_k81, K81_tab.cln_up_k81, K81_tab.cln_ui_k81, K81_tab.clnext_k81, K81_tab.cxq_01_k81, K81_tab.coq_01_k81, K81_tab.prsmth_k81, K81_tab.fob_od_k81, K79_tab.idnk79_k79, 
                         K80_tab.idnk80_k80, K81_tab.idnk81_k81, Kaj_tab.idnkaj_kaj, Kaj_tab.shpnum_kaj, Kaj_tab.packed_kaj, Kaj_tab.podcod_kaj, Kaj_tab.poecod_kaj, Kaj_tab.bolnum_kaj, Kaj_tab.insdte_kaj, Kaj_tab.edi_id_kaj, 
                         Kaj_tab.t_mode_kaj, Kaj_tab.shptme_kaj, Kaj_tab.shpsta_kaj, Kaj_tab.shpdes_kaj, Kaj_tab.trakno_kaj, Kaj_tab.pkg_wt_kaj, Kaj_tab.wawuid_kaj, Kaj_tab.bxxcnt_kaj, Kaj_tab.boxcnt_kaj, K81_tab.idnk71_k81, 
                         Ka9_tab.idnkae_ka9, Kaj_tab.idnkbg_kaj, dbo.kab_tab.idnkab_kab, dbo.kaa_tab.idnkaa_kaa, K80_tab.piidno_k80
FROM            dbo.ka8_tab AS Ka8_tab INNER JOIN
                         dbo.ka9_tab AS Ka9_tab ON Ka8_tab.idnka8_ka8 = Ka9_tab.idnka8_ka9 INNER JOIN
                         dbo.k81_tab AS K81_tab ON Ka9_tab.idnk81_ka9 = K81_tab.idnk81_k81 INNER JOIN
                         dbo.k80_tab AS K80_tab ON K81_tab.idnk80_k81 = K80_tab.idnk80_k80 INNER JOIN
                         dbo.k79_tab AS K79_tab ON K80_tab.idnk79_k80 = K79_tab.idnk79_k79 INNER JOIN
                         dbo.kaj_tab AS Kaj_tab ON Ka9_tab.idnkaj_ka9 = Kaj_tab.idnkaj_kaj INNER JOIN
                         dbo.kab_tab ON Ka9_tab.idnka9_ka9 = dbo.kab_tab.idnka9_kab INNER JOIN
                         dbo.kaa_tab ON dbo.kab_tab.idnkaa_kab = dbo.kaa_tab.idnkaa_kaa










