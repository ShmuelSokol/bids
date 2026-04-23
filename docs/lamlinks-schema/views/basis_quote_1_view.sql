-- dbo.basis_quote_1_view



/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */

/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */


/* view basis_quote_1_view: add view */
/* view basis_quote_1_view: add view 
 view basis_quote_1_view: add view 
 view basis_quote_1_view: add view */
CREATE VIEW [dbo].[basis_quote_1_view]
AS
SELECT DISTINCT 
                         dbo.k34_tab.upname_k34, dbo.rfq_line_item_1_view.e_name_k12, dbo.rfq_line_item_1_view.s_code_k39, dbo.vendor_quote_1_query.minqty_k57, dbo.vendor_quote_1_query.untcst_k57, 
                         dbo.vendor_quote_1_query.p_um_k56, dbo.vendor_quote_1_query.su_lbs_k56, dbo.vendor_quote_1_query.pr_num_k11, dbo.vendor_quote_1_query.idnk08_k08, dbo.vendor_quote_1_query.idnk11_k11, 
                         dbo.vendor_quote_1_query.idnk43_k43, dbo.k34_tab.idnk34_k34, dbo.rfq_line_item_1_view.rfq_no_k42, dbo.vendor_quote_1_query.idnk55_k55, dbo.vendor_quote_1_query.idnk57_k57
FROM            dbo.kau_tab INNER JOIN
                         dbo.vendor_quote_1_query ON dbo.kau_tab.idngx2_kau = dbo.vendor_quote_1_query.idnk57_k57 INNER JOIN
                         dbo.rfq_line_item_1_view ON dbo.vendor_quote_1_query.idnk43_k43 = dbo.rfq_line_item_1_view.idnk43_k43 LEFT OUTER JOIN
                         dbo.k34_tab ON dbo.kau_tab.idngx1_kau = dbo.k34_tab.idnk34_k34
WHERE        (dbo.kau_tab.gx2tbl_kau = 'k57') AND (dbo.kau_tab.gx1tbl_kau = 'k34')















