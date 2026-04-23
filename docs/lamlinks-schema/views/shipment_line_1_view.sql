-- dbo.shipment_line_1_view



/* view shipment_line_1_view: add view */


/* view shipment_line_1_view: add view */


/* view shipment_line_1_view: add view */

/* view shipment_line_1_view: add view */


/* view shipment_line_1_view: add view */


/* view shipment_line_1_view: add view */


/* view shipment_line_1_view: add view */
CREATE VIEW [dbo].[shipment_line_1_view]
AS
SELECT        K79_tab.cntrct_k79, K80_tab.rel_no_k80, K81_tab.clinno_k81, K80_tab.faspay_k80, Ka8_tab.job_no_ka8, Ka9_tab.jln_no_ka9, Ka9_tab.jlndte_ka9, Ka9_tab.jrqpur_ka9, Ka9_tab.jlnqty_ka9, Ka9_tab.jlnsta_ka9, 
                         Ka9_tab.jlnsdt_ka9, Ka9_tab.pinval_ka9, Ka9_tab.xinval_ka9, Ka9_tab.potval_ka9, Ka9_tab.selval_ka9, Ka9_tab.idnk81_ka9, Ka8_tab.idnka8_ka8, Ka9_tab.idnka9_ka9, K08_tab.fsc_k08, K08_tab.niin_k08, 
                         K71_tab.prtnum_k71, K81_tab.pr_num_k81, K81_tab.clnqty_k81, K81_tab.upkqty_k81, K81_tab.cln_up_k81, K81_tab.cln_ui_k81, K81_tab.clnext_k81, K81_tab.reqdly_k81, K81_tab.cxq_01_k81, 
                         K81_tab.coq_01_k81, K81_tab.prsmth_k81, K81_tab.fob_od_k81, K81_tab.ins_sd_k81, K81_tab.acc_sd_k81, K81_tab.ordrno_k81, K79_tab.idnk79_k79, K80_tab.idnk80_k80, K81_tab.idnk81_k81, 
                         Kaj_tab.idnkaj_kaj, Kaj_tab.shpnum_kaj, Kaj_tab.packed_kaj, Kaj_tab.podcod_kaj, Kaj_tab.poecod_kaj, Kaj_tab.bolnum_kaj, Kaj_tab.insdte_kaj, Kaj_tab.edi_id_kaj, Kaj_tab.t_mode_kaj, Kaj_tab.shptme_kaj, 
                         Kaj_tab.shpsta_kaj, Kaj_tab.trakno_kaj, Kaj_tab.pkg_wt_kaj, Kaj_tab.wawuid_kaj, Kaj_tab.bxxcnt_kaj, Kaj_tab.boxcnt_kaj, Kaj_tab.shpdes_kaj, K12_tab.e_code_k12, K12_tab.e_name_k12, Ka7_tab.gduset_ka7, 
                         K12_tab.idnk12_k12, K71_tab.idnk71_k71, Ka7_tab.idnka7_ka7, Kaj_tab.idnkbg_kaj, K08_tab.idnk08_k08, K80_tab.piidno_k80, K80_tab.docntr_k80
FROM            dbo.ka7_tab AS Ka7_tab INNER JOIN
                         dbo.ka6_tab AS Ka6_tab ON Ka7_tab.idnka7_ka7 = Ka6_tab.idnka7_ka6 INNER JOIN
                         dbo.ka8_tab AS Ka8_tab INNER JOIN
                         dbo.ka9_tab AS Ka9_tab ON Ka8_tab.idnka8_ka8 = Ka9_tab.idnka8_ka9 INNER JOIN
                         dbo.k81_tab AS K81_tab ON Ka9_tab.idnk81_ka9 = K81_tab.idnk81_k81 INNER JOIN
                         dbo.k80_tab AS K80_tab ON K81_tab.idnk80_k81 = K80_tab.idnk80_k80 INNER JOIN
                         dbo.k79_tab AS K79_tab ON K80_tab.idnk79_k80 = K79_tab.idnk79_k79 INNER JOIN
                         dbo.kaj_tab AS Kaj_tab ON Ka9_tab.idnkaj_ka9 = Kaj_tab.idnkaj_kaj ON Ka6_tab.idngdu_ka6 = Kaj_tab.idnkaj_kaj INNER JOIN
                         dbo.k12_tab AS K12_tab ON Ka7_tab.idnk12_ka7 = K12_tab.idnk12_k12 INNER JOIN
                         dbo.k71_tab AS K71_tab ON K81_tab.idnk71_k81 = K71_tab.idnk71_k71 INNER JOIN
                         dbo.k08_tab AS K08_tab ON K71_tab.idnk08_k71 = K08_tab.idnk08_k08
WHERE        (Ka6_tab.gdutbl_ka6 = 'kaj')







