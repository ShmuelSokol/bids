-- dbo.shipping_request_line_4_view



/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */

/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */


/* view shipping_request_line_4_view: add view */
/* view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view 
 view shipping_request_line_4_view: add view */
CREATE VIEW [dbo].[shipping_request_line_4_view]
AS
SELECT DISTINCT 
                         dbo.shipping_request_line_2_view.sprnum_kcu, dbo.shipping_request_line_2_view.srsdte_kcu, dbo.shipping_request_line_2_view.srssta_kcu, dbo.shipping_request_line_2_view.por_no_k89 AS por_no_1po, 
                         dbo.shipping_request_line_2_view.e_code_vnd AS s_code_1po, dbo.shipping_request_line_2_view.e_name_vnd AS e_name_1po, dbo.shipping_request_line_2_view.idnk90_k90 AS idnk90_1po, 
                         dbo.shipping_request_line_2_view.fsc_k08 AS fsc_1po, dbo.shipping_request_line_2_view.niin_k08 AS niin_1po, dbo.shipping_request_line_2_view.prtnum_k71 AS prtnum_1po, 
                         dbo.shipping_request_line_2_view.p_desc_k71 AS p_desc_1po, dbo.clin_basic_1_view.cntrct_k79 AS cntrct_ndf, dbo.clin_basic_1_view.rel_no_k80 AS rel_no_ndf, 
                         dbo.clin_basic_1_view.clinno_k81 AS clinno_ndf, dbo.clin_basic_1_view.prtnum_k71 AS prtnum_ndf, dbo.clin_basic_1_view.p_desc_k71 AS p_desc_ndf, dbo.clin_basic_1_view.fsc_k08 AS fsc_ndf, 
                         dbo.clin_basic_1_view.niin_k08 AS niin_ndf, dbo.shipping_request_line_2_view.idnkcu_kcu, dbo.shipping_request_line_2_view.srl_no_kcv, dbo.shipping_request_line_2_view.rtnsta_kcv, 
                         dbo.shipping_request_line_2_view.srlqty_kcv, dbo.shipping_request_line_2_view.rtndte_kcv, dbo.clin_basic_1_view.cln_ui_k81, dbo.shipping_request_line_2_view.rtnqty_kcv, 
                         dbo.clin_basic_1_view.idnk81_k81, dbo.shipping_request_line_2_view.idnk71_k71 AS idnk71_1po, dbo.clin_basic_1_view.idnk71_k71 AS idnk71_ndf, dbo.shipping_request_line_2_view.idnkcv_kcv, 
                         dbo.shipping_request_line_2_view.srstab_kcv, dbo.shipping_request_line_2_view.idnsrs_kcv, dbo.shipping_request_line_2_view.ormnum_kcu, dbo.shipping_request_line_2_view.sprtyp_kcu, 
                         dbo.clin_basic_1_view.idnk08_k08, dbo.clin_basic_1_view.piidno_k80
FROM            dbo.shipping_request_line_2_view INNER JOIN
                         dbo.clin_basic_1_view ON dbo.shipping_request_line_2_view.idnaft_kcv = dbo.clin_basic_1_view.idnk81_k81 AND dbo.shipping_request_line_2_view.afttab_kcv = 'k81'










